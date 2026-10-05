import { ensureSession } from "@/lib/server/session";
import { lockState } from "@/lib/server/workers";
import { select } from "@/lib/server/db";

export const dynamic = "force-dynamic";

// Who am I on this device? Creates the device cookie on the first visit.
export async function GET() {
  try {
    const s = await ensureSession();
    if (!s.a) return Response.json({ address: null, name: null, locked: false, lockedHere: false });
    const [lock, [w]] = await Promise.all([
      lockState(s.a, s.d),
      select("wallets", { columns: "display_name", filters: { address: `eq.${s.a}` }, limit: 1 }),
    ]);
    return Response.json({ address: s.a, name: w?.display_name ?? null, ...lock });
  } catch {
    return Response.json({ error: "Session service unavailable." }, { status: 503 });
  }
}
