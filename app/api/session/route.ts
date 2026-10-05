import { ensureSession } from "@/lib/server/session";
import { lockState } from "@/lib/server/workers";
import { select } from "@/lib/server/db";
import { workState } from "@/lib/server/shifts";

export const dynamic = "force-dynamic";

// Who am I on this device? Creates the device cookie on the first visit.
// Also returns the work file: cooldown, guest shift waiting for an address, today's shifts, history.
export async function GET() {
  try {
    const s = await ensureSession();
    const work = await workState(s).catch(() => null);
    if (!s.a) return Response.json({ address: null, name: null, locked: false, lockedHere: false, work });
    const [lock, [w]] = await Promise.all([
      lockState(s.a, s.d),
      select("wallets", { columns: "display_name", filters: { address: `eq.${s.a}` }, limit: 1 }),
    ]);
    return Response.json({ address: s.a, name: w?.display_name ?? null, ...lock, work });
  } catch {
    return Response.json({ error: "Session service unavailable." }, { status: 503 });
  }
}
