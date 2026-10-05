import { getResume } from "@/lib/server/hold";
import { isValidAddress, ChainError } from "@/lib/server/solana";

export const dynamic = "force-dynamic";

// Public, read-only: balance, holding bonus, streak, rank and earnings of an address.
export async function GET(_req: Request, ctx: { params: Promise<{ address: string }> }) {
  const { address } = await ctx.params;
  if (!isValidAddress(address)) {
    return Response.json({ error: "That doesn't look like a Solana address." }, { status: 400 });
  }
  try {
    return Response.json(await getResume(address), {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (e) {
    const code = e instanceof ChainError ? e.code : "unknown";
    const msg =
      code === "no_mint" ? "The coin isn't configured yet." :
      code === "not_configured" || code === "bad_key" ? "Chain reader isn't configured." :
      code === "rate_limited" ? "Too many lookups right now. Try again in a minute." :
      "Couldn't read the chain right now. Try again.";
    const detail = String((e as Error)?.message || "").slice(0, 200);
    return Response.json({ error: msg, code, detail }, { status: code === "rate_limited" ? 429 : 503 });
  }
}
