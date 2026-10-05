// Rate limits, captcha, name filter and signature check. Server only.

import { createPublicKey, verify as edVerify } from "node:crypto";
import { rpc } from "./db";
import { clientIp } from "./session";
import { decodeBase58 } from "./solana";

if (typeof window !== "undefined") {
  throw new Error("lib/server/guard.ts must never run in the browser");
}

/** true = allowed. Fails OPEN on a DB error so a hiccup doesn't lock everyone out. */
export async function allow(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    return await rpc<boolean>("hit_rate_limit", { p_key: key, p_window_seconds: windowSeconds, p_max: max });
  } catch {
    return true;
  }
}

export const tooMany = () =>
  Response.json({ error: "Slow down, human. Too many requests. Try again in a few minutes." }, { status: 429 });

/** Cloudflare Turnstile check. Without a secret configured it is skipped (preview only). */
export async function verifyCaptcha(token: unknown): Promise<boolean> {
  const secret = (process.env.TURNSTILE_SECRET_KEY || "").trim();
  if (!secret) return process.env.NEXT_PUBLIC_SOLANA_NETWORK !== "mainnet" ? true : false;
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({ secret, response: token, remoteip: await clientIp() });
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const data = await res.json();
    return data?.success === true;
  } catch {
    return false;
  }
}

// Names are shown on the site and on share cards: plain characters, short, no slurs.
const BLOCKED = [
  "nigg", "fag", "retard", "kike", "chink", "spic", "tranny", "hitler", "nazi",
  "fuck", "cunt", "shit", "rape", "porn", "pedo", "whore", "slut",
];
export function cleanDisplayName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.replace(/[^\p{L}\p{N} ._-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 20);
  if (!s) return null;
  const flat = s.toLowerCase().replace(/0/g, "o").replace(/[1!|]/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/[^a-z]/g, "");
  if (BLOCKED.some((w) => flat.includes(w))) return null;
  return s;
}

/** ed25519 check of a wallet's message signature (Phantom / Solflare / Backpack signMessage) */
export function verifyWalletSignature(address: string, message: string, signatureB64: string): boolean {
  try {
    const pub = decodeBase58(address);
    const sig = Buffer.from(signatureB64, "base64");
    if (pub.length !== 32 || sig.length !== 64) return false;
    const spki = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), pub]);
    const key = createPublicKey({ key: spki, format: "der", type: "spki" });
    return edVerify(null, Buffer.from(message, "utf8"), key, sig);
  } catch {
    return false;
  }
}
