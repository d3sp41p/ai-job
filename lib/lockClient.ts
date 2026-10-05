"use client";

// Browser side of "Lock my address": ask the wallet app to sign the server's message.
// Works with Phantom, Solflare and Backpack (desktop extension or their in-app browser).

type Provider = {
  connect: () => Promise<{ publicKey?: { toString(): string } } | void>;
  signMessage: (msg: Uint8Array, display?: string) => Promise<{ signature: Uint8Array; publicKey?: { toString(): string } } | Uint8Array>;
  publicKey?: { toString(): string } | null;
};

function findProvider(): Provider | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  const candidates = [w.phantom?.solana, w.solflare, w.backpack, w.solana];
  return candidates.find((p) => p && typeof p.signMessage === "function") ?? null;
}

export const hasWallet = () => !!findProvider();

/** On a phone without a wallet browser: reopen this page inside Phantom */
export function openInPhantom() {
  const url = encodeURIComponent(window.location.href);
  const ref = encodeURIComponent(window.location.origin);
  window.location.href = `https://phantom.app/ul/browse/${url}?ref=${ref}`;
}

const toB64 = (bytes: Uint8Array) => {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
};

export type Redeemed = { game: string; points: number; reason: "cooldown" | "no_coins" | "low_score" | null } | null;
export type LockResult = { ok: true; address: string; redeemed: Redeemed } | { ok: false; error: string };

export async function signAndLock(address: string): Promise<LockResult> {
  const p = findProvider();
  if (!p) return { ok: false, error: "No wallet app found in this browser." };

  const nonceRes = await fetch("/api/lock/nonce", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  const n = await nonceRes.json().catch(() => ({}));
  if (!nonceRes.ok) return { ok: false, error: n.error || "Couldn't start signing. Try again." };

  let signature: Uint8Array;
  try {
    const conn = await p.connect();
    const who = (conn && "publicKey" in conn && conn.publicKey) || p.publicKey;
    if (who && who.toString() !== address) {
      return { ok: false, error: "Your wallet app is on a different address. Switch to the payroll address and try again." };
    }
    const res = await p.signMessage(new TextEncoder().encode(n.message), "utf8");
    signature = res instanceof Uint8Array ? res : res.signature;
  } catch {
    return { ok: false, error: "Signing was cancelled." };
  }

  const v = await fetch("/api/lock/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nonce: n.nonce, signature: toB64(signature) }),
  });
  const body = await v.json().catch(() => ({}));
  if (!v.ok) return { ok: false, error: body.error || "Couldn't lock the address." };
  return { ok: true, address: body.address, redeemed: body.redeemed ?? null };
}
