import { randomBytes } from "node:crypto";
import { ensureSession, ipHash } from "@/lib/server/session";
import { allow, tooMany } from "@/lib/server/guard";
import { insert } from "@/lib/server/db";
import { isValidAddress } from "@/lib/server/solana";
import { lockMessage } from "@/lib/lockMessage";
import { LOCK_NONCE_MINUTES } from "@/lib/config";

export const dynamic = "force-dynamic";

// Step 1 of "Lock my address": the server hands out a one-time message to sign.
export async function POST(req: Request) {
  if (!(await allow(`nonce:ip:${await ipHash()}`, 10, 600))) return tooMany();
  const body = await req.json().catch(() => ({}));
  const address = typeof body.address === "string" ? body.address.trim() : "";
  if (!isValidAddress(address)) return Response.json({ error: "Not a Solana address." }, { status: 400 });
  try {
    const s = await ensureSession();
    const nonce = randomBytes(16).toString("hex");
    const expires = new Date(Date.now() + LOCK_NONCE_MINUTES * 60_000).toISOString();
    await insert("auth_nonces", { nonce, address, expires_at: expires });
    return Response.json({ nonce, message: lockMessage({ address, device: s.d, nonce, expires }) });
  } catch {
    return Response.json({ error: "Try again." }, { status: 503 });
  }
}
