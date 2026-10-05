// Device session: an httpOnly cookie signed with SESSION_SECRET.
// It holds a random device id and the payroll address chosen on this device.
// The worker's address is ALWAYS taken from here, never from the request body.

import { createHmac, createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { insert, select } from "./db";

if (typeof window !== "undefined") {
  throw new Error("lib/server/session.ts must never run in the browser");
}

const COOKIE = "aij_s";
const MAX_AGE = 60 * 60 * 24 * 365; // device id lives a year

export type Session = { d: string; a: string | null };

function secret() {
  const s = (process.env.SESSION_SECRET || "").trim();
  if (s.length < 32) throw new Error("SESSION_SECRET is missing or too short");
  return s;
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

function encode(s: Session) {
  const p = b64(JSON.stringify(s));
  return `${p}.${sign(p)}`;
}

function decode(raw: string | undefined): Session | null {
  if (!raw) return null;
  const [p, sig] = raw.split(".");
  if (!p || !sig) return null;
  const good = Buffer.from(sign(p));
  const got = Buffer.from(sig);
  if (good.length !== got.length || !timingSafeEqual(good, got)) return null;
  try {
    const s = JSON.parse(Buffer.from(p, "base64url").toString());
    if (typeof s?.d !== "string") return null;
    return { d: s.d, a: typeof s.a === "string" ? s.a : null };
  } catch {
    return null;
  }
}

/** Client IP (Vercel puts the real one first in x-forwarded-for) */
export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "0.0.0.0").trim();
}

/** We never store raw IPs, only a keyed hash */
export async function ipHash() {
  return createHash("sha256").update(`${secret()}|${await clientIp()}`).digest("hex").slice(0, 32);
}

export async function readSession(): Promise<Session | null> {
  return decode((await cookies()).get(COOKIE)?.value);
}

export async function writeSession(s: Session) {
  (await cookies()).set(COOKIE, encode(s), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/** Existing session, or a brand new device (row in `devices` + cookie) */
export async function ensureSession(): Promise<Session> {
  const s = await readSession();
  if (s) {
    // the device row may be missing if the DB was reset
    const rows = await select("devices", { columns: "id", filters: { id: `eq.${s.d}` }, limit: 1 });
    if (rows.length) return s;
  }
  const id = randomUUID();
  await insert("devices", { id, ip_hash: await ipHash() });
  const fresh: Session = { d: id, a: null };
  await writeSession(fresh);
  return fresh;
}
