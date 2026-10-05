import { ensureSession, writeSession, ipHash } from "@/lib/server/session";
import { assignAddress, lockState, WorkerError } from "@/lib/server/workers";
import { allow, tooMany, cleanDisplayName } from "@/lib/server/guard";
import { isValidAddress } from "@/lib/server/solana";

export const dynamic = "force-dynamic";

// Put a payroll address on this device. Nothing is signed: we only read the address.
export async function POST(req: Request) {
  if (!(await allow(`addr:ip:${await ipHash()}`, 15, 600))) return tooMany();
  const body = await req.json().catch(() => ({}));
  const address = typeof body.address === "string" ? body.address.trim() : "";
  if (!isValidAddress(address)) {
    return Response.json({ error: "That doesn't look like a Solana address. Paste the full address from your wallet app." }, { status: 400 });
  }
  const rawName = typeof body.name === "string" ? body.name : "";
  const name = rawName.trim() ? cleanDisplayName(rawName) : undefined;
  if (rawName.trim() && !name) {
    return Response.json({ error: "HR rejected that name. Try something else." }, { status: 400 });
  }
  try {
    const s = await ensureSession();
    await assignAddress(s, address, { name });
    await writeSession({ d: s.d, a: address });
    return Response.json({ address, name: name ?? null, ...(await lockState(address, s.d)) });
  } catch (e) {
    if (e instanceof WorkerError) return Response.json({ error: e.message, code: e.code }, { status: e.status });
    return Response.json({ error: "Couldn't save your address. Try again." }, { status: 503 });
  }
}

// "Use another address": forget it on this device (the device itself stays)
export async function DELETE() {
  try {
    const s = await ensureSession();
    await writeSession({ d: s.d, a: null });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Try again." }, { status: 503 });
  }
}
