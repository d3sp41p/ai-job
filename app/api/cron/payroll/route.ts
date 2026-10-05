import { timingSafeEqual } from "node:crypto";
import { runPayroll } from "@/lib/server/payroll";
import { ChainError } from "@/lib/server/solana";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Hourly payroll. Only the scheduler may call it: "Authorization: Bearer <CRON_SECRET>".
function authorized(req: Request) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (secret.length < 16) return false;
  const got = Buffer.from(req.headers.get("authorization") || "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Not allowed." }, { status: 401 });
  try {
    return Response.json({ ok: true, ...(await runPayroll()) });
  } catch (e) {
    // nothing is half-done: each hour settles in one database transaction, the next run catches up
    const code = e instanceof ChainError ? e.code : "unknown";
    return Response.json({ ok: false, code, detail: String((e as Error)?.message || "").slice(0, 200) }, { status: 503 });
  }
}
