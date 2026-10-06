// Hourly payroll: share each finished hour's slice between the people who worked in it.
// Called by the database's scheduler (pg_cron) through /api/cron/payroll. Server only.

import { PAYOUTS_PER_DAY, PERIOD_MS, SALARY_POOL_SHARE, WALLET_HOURLY_CAP } from "@/lib/config";
import { rpc, select } from "./db";
import { readTreasury } from "./treasury";

if (typeof window !== "undefined") {
  throw new Error("lib/server/payroll.ts must never run in the browser");
}

const HOUR = 3_600_000;
const PERIOD = PERIOD_MS; // one payroll round
const CATCH_UP_HOURS = 48; // if the scheduler missed runs, settle up to two days back

/** Finished hours that still need settling: the last hour, plus any older hour with points */
async function hoursToSettle(now = Date.now()) {
  const current = Math.floor(now / PERIOD) * PERIOD;
  const since = new Date(current - CATCH_UP_HOURS * HOUR).toISOString();
  const [worked, settled] = await Promise.all([
    select("game_sessions", {
      columns: "payroll_hour",
      filters: { payroll_hour: `gte.${since}`, points: "gt.0" },
      limit: 20000,
    }),
    select("payroll_hours", { columns: "hour_start", filters: { hour_start: `gte.${since}`, settled: "is.true" }, limit: 1000 }),
  ]);
  const done = new Set(settled.map((r: any) => Date.parse(r.hour_start)));
  const todo = new Set<number>([current - PERIOD]);
  for (const r of worked) {
    const h = Date.parse(r.payroll_hour);
    if (h < current) todo.add(h);
  }
  return [...todo].filter((h) => !done.has(h)).sort((a, b) => a - b);
}

export async function runPayroll() {
  const hours = await hoursToSettle();
  const settled: any[] = [];
  for (const h of hours) {
    // re-read every time: each settled hour adds to what we owe, which shrinks the treasury
    const t = await readTreasury();
    const r = await rpc<any>("settle_payroll_hour", {
      p_hour: new Date(h).toISOString(),
      p_treasury: t.treasurySol,
      p_pool_share: SALARY_POOL_SHARE,
      p_per_day: PAYOUTS_PER_DAY,
      p_cap: WALLET_HOURLY_CAP,
    });
    settled.push(r);
    // a period the database refuses (not over yet / not aligned) must not block the ones after it
    if (!r?.ok && r?.error !== "period_not_over") break;
  }
  const t = await readTreasury().catch(() => null);
  return { settled, payoutWalletShort: t?.payoutWalletShort ?? null };
}
