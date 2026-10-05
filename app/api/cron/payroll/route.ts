import { timingSafeEqual } from "node:crypto";
import { runPayroll } from "@/lib/server/payroll";
import { runPayouts, PayoutError } from "@/lib/server/payouts";
import { ChainError } from "@/lib/server/solana";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Hourly job: 1) settle last hour's payroll, 2) send payouts.
// Only the scheduler may call it: "Authorization: Bearer <CRON_SECRET>".
function authorized(req: Request) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (secret.length < 16) return false;
  const got = Buffer.from(req.headers.get("authorization") || "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

const describe = (e: unknown) => ({
  ok: false,
  code: e instanceof ChainError || e instanceof PayoutError ? e.code : "unknown",
  // our own messages and RPC errors only, never keys
  detail: String((e as Error)?.message || "").slice(0, 200),
});

export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Not allowed." }, { status: 401 });

  // each hour settles in one database transaction; a failed run is caught up next hour
  const payroll = await runPayroll().then((r) => ({ ok: true, ...r }), describe);
  // payouts run even if the payroll read failed: money already owed should still go out
  const payouts = await runPayouts().then((r) => ({ ok: true, ...r }), describe);

  return Response.json({ payroll, payouts }, { status: payroll.ok && payouts.ok ? 200 : 503 });
}
