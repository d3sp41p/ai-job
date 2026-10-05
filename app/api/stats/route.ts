import { siteStats } from "@/lib/server/stats";

export const dynamic = "force-dynamic";

// Public numbers for the home page, Payroll and the ticker. Cached for 30 s at the edge.
export async function GET() {
  try {
    return Response.json(await siteStats(), {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" },
    });
  } catch {
    return Response.json({ error: "Stats are unavailable right now." }, { status: 503 });
  }
}
