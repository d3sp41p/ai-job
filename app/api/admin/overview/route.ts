import { isAdmin, denied } from "@/lib/server/admin";
import { select } from "@/lib/server/db";
import { readTreasury } from "@/lib/server/treasury";
import { payoutsPaused } from "@/lib/server/payouts";
import { DAILY_PAYOUT_CAP_SOL, MAX_PAYOUT_SOL } from "@/lib/config";

export const dynamic = "force-dynamic";

// Everything the team needs on one screen. Admins only.
export async function GET() {
  if (!(await isAdmin())) return denied();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const [treasury, paused, hours, payouts, flagged, banned, owedRows, log] = await Promise.all([
    readTreasury().catch((e) => ({ error: String(e?.message || e).slice(0, 200) })),
    payoutsPaused().catch(() => true),
    select("payroll_hours", {
      columns: "hour_start,treasury_sol,slice_sol,total_points,workers,distributed_sol,settled",
      order: "hour_start.desc",
      limit: 24,
    }),
    select("payouts", {
      columns: "id,wallet,amount_sol,status,tx_signature,error,created_at,updated_at",
      filters: { status: "in.(pending,failed)" },
      order: "created_at.desc",
      limit: 50,
    }),
    select("game_sessions", {
      columns: "id,wallet,game_id,performance,points,flagged,started_at",
      filters: { flagged: "not.is.null" },
      order: "started_at.desc",
      limit: 50,
    }),
    select("wallets", { columns: "address,display_name,tasks_completed", filters: { banned: "is.true" }, limit: 200 }),
    select("balances", { columns: "wallet,accrued_sol,paid_sol", order: "accrued_sol.desc", limit: 50 }),
    select("admin_log", { columns: "at,actor,action,details", order: "at.desc", limit: 30 }),
  ]);
  const paidToday = await select("payouts", {
    columns: "amount_sol",
    filters: { status: "eq.paid", updated_at: `gte.${since}` },
    limit: 100000,
  });

  return Response.json({
    treasury,
    paused,
    limits: { maxPayoutSol: MAX_PAYOUT_SOL, dailyCapSol: DAILY_PAYOUT_CAP_SOL },
    paidTodaySol: paidToday.reduce((s: number, r: any) => s + Number(r.amount_sol), 0),
    hours,
    payouts,
    flagged,
    banned,
    owed: owedRows
      .map((r: any) => ({ wallet: r.wallet, owedSol: Number(r.accrued_sol) - Number(r.paid_sol) }))
      .filter((r: any) => r.owedSol > 0),
    log,
  });
}
