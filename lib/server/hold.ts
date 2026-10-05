// Holding status for a wallet: balance, lowest balance in 24h, streak, multipliers.
// Cached in wallets.hold_cache for 10 minutes; `fresh: true` forces a new chain read
// (used before a shift starts and before a payout).

import { MIN_HOLD, holdMultiplier, streakMultiplier, rankFor } from "@/lib/config";
import { getHoldInfo } from "./solana";
import { insert, select } from "./db";

export const HOLD_CACHE_MINUTES = 10;

export type HoldStatus = {
  address: string;
  balance: number;
  minBalance24h: number;
  holdStart: string | null; // ISO
  daysHeld: number;
  holdMultiplier: number; // from the LOWEST balance in the last 24h
  streakMultiplier: number;
  eligible: boolean; // holds the minimum right now AND all of the last 24h
  minHold: number;
  historyComplete: boolean;
  checkedAt: string;
};

function build(address: string, info: Awaited<ReturnType<typeof getHoldInfo>>, extraMin?: number): HoldStatus {
  const min24 = Math.min(info.minBalance24h, extraMin ?? Infinity, info.balance);
  const daysHeld = info.holdStart ? Math.floor((Date.now() - info.holdStart) / 86_400_000) : 0;
  const hm = holdMultiplier(min24);
  return {
    address,
    balance: info.balance,
    minBalance24h: min24,
    holdStart: info.holdStart ? new Date(info.holdStart).toISOString() : null,
    daysHeld,
    holdMultiplier: hm,
    streakMultiplier: info.holdStart ? streakMultiplier(daysHeld) : 1,
    eligible: info.balance >= MIN_HOLD && hm > 0,
    minHold: MIN_HOLD,
    historyComplete: info.historyComplete,
    checkedAt: new Date().toISOString(),
  };
}

export async function getHoldStatus(address: string, opts: { fresh?: boolean } = {}): Promise<HoldStatus> {
  if (!opts.fresh) {
    const rows = await select("wallets", {
      columns: "hold_cache,hold_cached_at",
      filters: { address: `eq.${address}` },
      limit: 1,
    }).catch(() => []);
    const r = rows[0];
    if (r?.hold_cache && r.hold_cached_at && Date.now() - Date.parse(r.hold_cached_at) < HOLD_CACHE_MINUTES * 60_000) {
      return r.hold_cache as HoldStatus;
    }
  }

  const info = await getHoldInfo(address, MIN_HOLD);

  // our own recorded checks are a second source for the 24h minimum
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const checks = await select("balance_checks", {
    columns: "balance",
    filters: { wallet: `eq.${address}`, checked_at: `gte.${since}` },
    order: "balance.asc",
    limit: 1,
  }).catch(() => []);
  const recordedMin = checks[0] ? Number(checks[0].balance) : undefined;

  const status = build(address, info, recordedMin);

  // cache + record (best effort: a DB hiccup must not break the read)
  try {
    await insert(
      "wallets",
      { address, hold_cache: status, hold_cached_at: status.checkedAt },
      "address"
    );
    await insert("balance_checks", { wallet: address, balance: status.balance });
  } catch {
    /* ignore */
  }
  return status;
}

/** Public resume: hold status + work record. Read-only. */
export async function getResume(address: string) {
  const hold = await getHoldStatus(address);
  const [w] = await select("wallets", {
    columns: "display_name,tasks_completed,created_at",
    filters: { address: `eq.${address}` },
    limit: 1,
  }).catch(() => []);
  const [b] = await select("balances", {
    columns: "accrued_sol,paid_sol",
    filters: { wallet: `eq.${address}` },
    limit: 1,
  }).catch(() => []);
  const tasks = Number(w?.tasks_completed || 0);
  return {
    ...hold,
    name: w?.display_name || null,
    tasksCompleted: tasks,
    rank: rankFor(tasks).title,
    earnedSol: Number(b?.paid_sol || 0),
    unpaidSol: Math.max(0, Number(b?.accrued_sol || 0) - Number(b?.paid_sol || 0)),
  };
}
