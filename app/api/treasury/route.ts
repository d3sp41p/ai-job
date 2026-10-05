import { ChainError, network } from "@/lib/server/solana";
import { readTreasury } from "@/lib/server/treasury";

export const dynamic = "force-dynamic";

// Public: live treasury numbers. Treasury = TREASURY + PAYOUT balances minus salaries owed.
export async function GET() {
  try {
    const t = await readTreasury();
    return Response.json(
      { network: network(), ...t },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch (e) {
    const code = e instanceof ChainError ? e.code : "unknown";
    // the RPC message never contains our key, safe to show
    const detail = String((e as Error)?.message || "").slice(0, 200);
    const error = code === "not_configured" || code === "bad_address" ? detail : "Couldn't read the treasury right now.";
    return Response.json({ error, code, detail, network: network() }, { status: 503 });
  }
}
