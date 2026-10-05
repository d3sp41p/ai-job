import { ensureSession, writeSession, ipHash } from "@/lib/server/session";
import { redeemGuestShift } from "@/lib/server/shifts";
import { allow, tooMany, verifyWalletSignature } from "@/lib/server/guard";
import { assignAddress, lockState, WorkerError } from "@/lib/server/workers";
import { update, insert } from "@/lib/server/db";
import { lockMessage } from "@/lib/lockMessage";

export const dynamic = "force-dynamic";

// Step 2 of "Lock my address": check the wallet's signature, then lock the address to this device.
export async function POST(req: Request) {
  if (!(await allow(`verify:ip:${await ipHash()}`, 10, 600))) return tooMany();
  const body = await req.json().catch(() => ({}));
  const nonce = typeof body.nonce === "string" ? body.nonce : "";
  const signature = typeof body.signature === "string" ? body.signature : "";
  if (!/^[0-9a-f]{32}$/.test(nonce) || !signature) return Response.json({ error: "Bad request." }, { status: 400 });

  try {
    const s = await ensureSession();
    // burn the nonce atomically: only an unused, unexpired one comes back
    const rows = await update(
      "auth_nonces",
      { nonce: `eq.${nonce}`, used: "eq.false", expires_at: `gt.${new Date().toISOString()}` },
      { used: true }
    );
    const row = rows[0];
    if (!row) return Response.json({ error: "This signing request expired. Try again." }, { status: 400 });

    const message = lockMessage({
      address: row.address,
      device: s.d,
      nonce,
      expires: new Date(row.expires_at).toISOString(),
    });
    if (!verifyWalletSignature(row.address, message, signature)) {
      return Response.json({ error: "Signature doesn't match this address. Sign with the wallet that holds it." }, { status: 401 });
    }

    // the owner proved it: this device may work for the address, even if it was locked elsewhere
    await assignAddress(s, row.address, { proven: true });
    await insert("address_locks", { address: row.address, device_id: s.d }, "address,device_id");
    await writeSession({ d: s.d, a: row.address });
    const redeemed = await redeemGuestShift(s, row.address).catch(() => null);
    return Response.json({ address: row.address, ...(await lockState(row.address, s.d)), redeemed });
  } catch (e) {
    if (e instanceof WorkerError) return Response.json({ error: e.message, code: e.code }, { status: e.status });
    return Response.json({ error: "Couldn't lock the address. Try again." }, { status: 503 });
  }
}
