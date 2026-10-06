// Public site numbers: treasury, payouts, workers, this hour, leaderboard, recent payouts. Server only.

import { periodStart, rankFor } from "@/lib/config";
import { select } from "./db";
import { readTreasury } from "./treasury";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export async function siteStats() {
  const now = Date.now();
  const hour = new Date(periodStart(now)).toISOString(); // current payroll round
  const [treasury, paid, workers, hourRows, dayRows, hist] = await Promise.all([
    readTreasury().catch(() => null),
    select("payouts", {
      columns: "wallet,amount_sol,tx_signature,updated_at",
      filters: { status: "eq.paid" },
      order: "updated_at.desc",
      limit: 100000,
    }),
    select("wallets", { columns: "tasks_completed", filters: { tasks_completed: "gt.0" }, limit: 100000 }),
    select("game_sessions", { columns: "wallet,points", filters: { payroll_hour: `eq.${hour}`, points: "gt.0" }, limit: 100000 }),
    select("game_sessions", {
      columns: "wallet,points",
      filters: { started_at: `gte.${new Date(now - DAY).toISOString()}`, points: "gt.0", wallet: "not.is.null" },
      limit: 100000,
    }),
    select("payroll_hours", {
      columns: "hour_start,treasury_sol",
      filters: { hour_start: `gte.${new Date(now - 14 * DAY).toISOString()}`, settled: "is.true" },
      order: "hour_start.asc",
      limit: 400,
    }),
  ]);

  const totalPaidSol = paid.reduce((s: number, r: any) => s + Number(r.amount_sol), 0);
  const treasurySol = treasury?.treasurySol ?? 0;

  // leaderboard: points in the last 24 hours
  const byWallet = new Map<string, number>();
  for (const r of dayRows) byWallet.set(r.wallet, (byWallet.get(r.wallet) ?? 0) + Number(r.points));
  const top = [...byWallet.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const names = top.length
    ? await select("wallets", {
        columns: "address,display_name,tasks_completed",
        filters: { address: `in.(${top.map(([w]) => w).join(",")})` },
      })
    : [];
  const info = new Map(names.map((w: any) => [w.address, w]));
  const leaderboard = top.map(([address, points]) => {
    const w: any = info.get(address);
    const tasks = Number(w?.tasks_completed || 0);
    return { address, name: w?.display_name ?? null, rank: rankFor(tasks).title, tasks, points: Math.round(points * 10) / 10 };
  });

  // treasury chart: last reading of each day, then today's live value
  const perDay = new Map<string, number>();
  for (const h of hist) perDay.set(String(h.hour_start).slice(0, 10), Number(h.treasury_sol));
  const treasuryHistory = [...perDay.values(), treasurySol];
  if (treasuryHistory.length < 2) treasuryHistory.unshift(treasurySol);

  return {
    live: !!treasury,
    treasurySol,
    salaryPoolSol: treasury?.salaryPoolSol ?? 0,
    thisHourSol: treasury?.thisHourSol ?? 0,
    totalPaidSol,
    payouts: paid.length,
    workers: workers.length,
    tasksDone: workers.reduce((s: number, r: any) => s + Number(r.tasks_completed), 0),
    // everything the coin has earned = what's in the two company wallets + what was already paid out
    feesAllTimeSol: (treasury ? treasury.treasuryWalletSol + treasury.payoutWalletSol : 0) + totalPaidSol,
    hourPoints: Math.round(hourRows.reduce((s: number, r: any) => s + Number(r.points), 0) * 10) / 10,
    workersThisHour: new Set(hourRows.map((r: any) => r.wallet)).size,
    treasuryHistory,
    leaderboard,
    recentPayouts: paid.slice(0, 10).map((p: any) => ({
      address: p.wallet as string,
      amountSol: Number(p.amount_sol),
      at: Date.parse(p.updated_at),
      tx: p.tx_signature as string,
    })),
    treasuryAddress: (process.env.NEXT_PUBLIC_TREASURY_ADDRESS || "").trim(),
    payoutAddress: (process.env.NEXT_PUBLIC_PAYOUT_ADDRESS || "").trim(),
  };
}

export type SiteStats = Awaited<ReturnType<typeof siteStats>>;
