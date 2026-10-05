// Shifts on the server: pick the job, enforce the cooldown, accept the result once,
// count points, and hold a guest's shift until they add an address. Server only.
//
// Kept simple on purpose: the browser reports its score (0..1) and the server trusts it
// within limits (one result per shift, no impossible speed, cooldown, captcha, hold check).

import { randomInt } from "node:crypto";
import {
  COOLDOWN_MINUTES,
  GUEST_WINDOW_MINUTES,
  MIN_HOLD,
  MIN_SHIFT_SECONDS,
  PENDING_MINUTES,
  SHIFTS_PER_IP,
  SHIFT_EXPIRES_MINUTES,
  computePoints,
  rankFor,
  type Difficulty,
} from "@/lib/config";
import { GAMES } from "@/lib/games";
import { rpc, select, update } from "./db";
import { getHoldStatus } from "./hold";
import { ipHash, type Session } from "./session";
import { lockState, WorkerError } from "./workers";

if (typeof window !== "undefined") {
  throw new Error("lib/server/shifts.ts must never run in the browser");
}

export type Mode = "paid" | "practice" | "guest";
const DAY_MS = 24 * 3600_000;
const gameName = (id: string) => GAMES.find((g) => g.id === id)?.name ?? id;

/** Shifts that count toward the 12 paid shifts a day (the current one excluded) */
async function shiftsLast24h(wallet: string, excludeId?: string) {
  const rows = await select("game_sessions", {
    columns: "id",
    filters: {
      wallet: `eq.${wallet}`,
      status: "eq.finished",
      mode: "neq.practice",
      started_at: `gte.${new Date(Date.now() - DAY_MS).toISOString()}`,
    },
    limit: 200,
  });
  return rows.filter((r: any) => r.id !== excludeId).length;
}

async function updateRank(wallet: string, tasks: number | null | undefined) {
  if (typeof tasks !== "number") return;
  await update("wallets", { address: `eq.${wallet}` }, { rank: rankFor(tasks).title }).catch(() => {});
}

// ---------- start ----------

export async function startShift(s: Session, difficulty: Difficulty) {
  let mode: Mode = "guest";
  let overtime = false;
  if (s.a) {
    const [w] = await select("wallets", { columns: "banned", filters: { address: `eq.${s.a}` }, limit: 1 });
    if (w?.banned) throw new WorkerError("This address has been let go. Contact HR (you can't).", "banned", 403);
    const lock = await lockState(s.a, s.d);
    if (lock.locked && !lock.lockedHere) {
      throw new WorkerError("This address is locked to another device. Sign with your wallet to work from here.", "locked_elsewhere", 409);
    }
    // fresh chain read before every shift
    const hold = await getHoldStatus(s.a, { fresh: true });
    mode = hold.eligible ? "paid" : "practice";
    overtime = mode === "paid" && (await shiftsLast24h(s.a)) >= 12;
  }

  const pool = GAMES.filter((g) => g.difficulty === difficulty);
  const game = pool[randomInt(pool.length)];

  const r = await rpc<any>("start_shift", {
    p_wallet: s.a,
    p_device: s.d,
    p_ip: await ipHash(),
    p_game: game.id,
    p_difficulty: difficulty,
    p_mode: mode,
    p_cooldown_seconds: COOLDOWN_MINUTES * 60,
    p_expires_seconds: SHIFT_EXPIRES_MINUTES * 60,
    p_ip_max: SHIFTS_PER_IP,
  });
  if (!r?.ok) {
    if (r?.error === "cooldown") {
      throw Object.assign(new WorkerError("You're on a coffee break. The AI will call you when it needs you.", "cooldown", 429), {
        cooldownEndsAt: r.cooldown_ends_at,
      });
    }
    if (r?.error === "ip_busy") throw new WorkerError("Too many shifts from this network right now. Try again later.", "ip_busy", 429);
    throw new WorkerError("You already have a shift open.", "active", 409);
  }
  return { id: r.id as string, gameId: game.id, mode, overtime, cooldownEndsAt: r.cooldown_ends_at as string };
}

// ---------- finish ----------

const cleanSummary = (x: unknown) =>
  typeof x === "string" ? x.replace(/[^\p{L}\p{N} .,:;!?'’()%/+-]/gu, "").slice(0, 120) : "";

export async function finishShift(s: Session, id: string, rawPerf: unknown, rawSummary: unknown) {
  const [row] = await select("game_sessions", {
    columns: "id,wallet,difficulty,game_id,mode,started_at",
    filters: { id: `eq.${id}`, device_id: `eq.${s.d}`, status: "eq.active" },
    limit: 1,
  });
  if (!row) throw new WorkerError("This shift is already closed.", "closed", 409);

  const d = row.difficulty as Difficulty;
  const mode = row.mode as Mode;
  const elapsed = Date.now() - Date.parse(row.started_at);
  let performance = Math.max(0, Math.min(1, Number(rawPerf)));
  if (!Number.isFinite(performance)) performance = 0;
  let summary = cleanSummary(rawSummary);
  let flag: string | null = null;
  if (elapsed < MIN_SHIFT_SECONDS[d] * 1000) {
    performance = 0;
    flag = "too_fast";
    summary = "Nobody works that fast. The AI is suspicious.";
  }

  let points = computePoints(d, performance, MIN_HOLD, 0, 0); // base pay, shown to guests
  let guest: "pending" | "practice" | null = null;

  if (mode === "paid" && row.wallet) {
    const hold = await getHoldStatus(row.wallet).catch(() => null);
    const today = await shiftsLast24h(row.wallet, row.id);
    points = computePoints(d, performance, hold?.eligible ? Math.max(hold.minBalance24h, MIN_HOLD) : 0, hold?.daysHeld ?? 0, today);
  } else if (mode === "practice") {
    points = { ...points, total: 0 };
  }

  const r = await rpc<any>("finish_shift", {
    p_id: row.id,
    p_device: s.d,
    p_performance: performance,
    p_points: mode === "paid" ? points.total : 0,
    p_overtime: points.overtime,
    p_result: { summary },
    p_flag: flag,
    p_count_task: mode === "paid" && points.total > 0,
  });
  if (!r?.ok) throw new WorkerError("This shift is already closed.", "closed", 409);
  if (row.wallet) await updateRank(row.wallet, r.tasks_completed);

  if (mode === "guest") {
    guest = "practice";
    if (points.passed) {
      const held = await rpc<boolean>("hold_guest_shift", {
        p_device: s.d,
        p_session: row.id,
        p_wait_minutes: PENDING_MINUTES,
        p_window_minutes: GUEST_WINDOW_MINUTES,
      });
      if (held) guest = "pending";
    }
  }

  return { performance, summary, mode, guest, points };
}

// ---------- guest shift -> address ----------

/** After a guest adds an address: credit their waiting shift by the address's normal rules */
export async function redeemGuestShift(s: Session, address: string) {
  const g = await rpc<any>("claim_guest_shift", { p_device: s.d, p_wallet: address }).catch(() => null);
  if (!g?.id) return null;
  const game = gameName(g.game_id);

  // the address's own cooldown: it can't have started another shift close to this one
  const near = await select("game_sessions", {
    columns: "id,started_at",
    filters: { wallet: `eq.${address}`, id: `neq.${g.id}` },
    order: "started_at.desc",
    limit: 5,
  });
  const t = Date.parse(g.started_at);
  if (near.some((r: any) => Math.abs(Date.parse(r.started_at) - t) < COOLDOWN_MINUTES * 60_000)) {
    return { game, points: 0, reason: "cooldown" as const };
  }

  const hold = await getHoldStatus(address, { fresh: true }).catch(() => null);
  if (!hold?.eligible) return { game, points: 0, reason: "no_coins" as const };

  const today = await shiftsLast24h(address, g.id);
  const pts = computePoints(g.difficulty, Number(g.performance), Math.max(hold.minBalance24h, MIN_HOLD), hold.daysHeld, today);
  await rpc("credit_guest_shift", {
    p_id: g.id,
    p_wallet: address,
    p_points: pts.total,
    p_overtime: pts.overtime,
    p_count_task: pts.total > 0,
  });
  if (pts.total > 0) {
    const [w] = await select("wallets", { columns: "tasks_completed", filters: { address: `eq.${address}` }, limit: 1 });
    await updateRank(address, w?.tasks_completed);
  }
  return { game, points: pts.total, reason: pts.total > 0 ? null : ("low_score" as const) };
}

// ---------- what the office page shows ----------

export async function workState(s: Session) {
  const or = s.a ? `(device_id.eq.${s.d},wallet.eq.${s.a})` : `(device_id.eq.${s.d})`;
  const now = new Date();
  const hour = new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000).toISOString();
  const [last, pending, mine, hourRows, lastPaid] = await Promise.all([
    select("game_sessions", { columns: "started_at", filters: { or }, order: "started_at.desc", limit: 1 }),
    select("guest_shifts", {
      columns: "created_at,expires_at,game_sessions(game_id)",
      filters: { device_id: `eq.${s.d}`, redeemed_by: "is.null", expires_at: `gt.${now.toISOString()}` },
      order: "created_at.desc",
      limit: 1,
    }),
    s.a
      ? select("game_sessions", {
          columns: "id,game_id,difficulty,performance,points,status,mode,started_at",
          filters: { wallet: `eq.${s.a}`, status: "in.(finished,abandoned)", started_at: `gte.${new Date(now.getTime() - DAY_MS).toISOString()}` },
          order: "started_at.desc",
          limit: 100,
        })
      : Promise.resolve([]),
    s.a
      ? select("game_sessions", { columns: "points", filters: { wallet: `eq.${s.a}`, payroll_hour: `eq.${hour}` }, limit: 200 })
      : Promise.resolve([]),
    s.a
      ? select("payouts", {
          columns: "amount_sol,tx_signature,updated_at",
          filters: { wallet: `eq.${s.a}`, status: "eq.paid" },
          order: "updated_at.desc",
          limit: 1,
        })
      : Promise.resolve([]),
  ]);

  const lastStart = last[0] ? Date.parse(last[0].started_at) : 0;
  const cooldownEndsAt = lastStart + COOLDOWN_MINUTES * 60_000;
  const p = pending[0];
  return {
    cooldownEndsAt: cooldownEndsAt > now.getTime() ? cooldownEndsAt : null,
    pending: p ? { at: Date.parse(p.created_at), expiresAt: Date.parse(p.expires_at), game: gameName(p.game_sessions?.game_id ?? "") } : null,
    shiftsToday: mine.filter((r: any) => r.status === "finished" && r.mode !== "practice").length,
    lastPayout: lastPaid[0]
      ? { amount: Number(lastPaid[0].amount_sol), tx: lastPaid[0].tx_signature as string, at: Date.parse(lastPaid[0].updated_at) }
      : null,
    pointsThisHour: Math.round(hourRows.reduce((a: number, r: any) => a + Number(r.points || 0), 0) * 10) / 10,
    history: mine.slice(0, 20).map((r: any) => ({
      id: r.id,
      at: Date.parse(r.started_at),
      game: gameName(r.game_id),
      difficulty: r.difficulty as Difficulty,
      performance: Number(r.performance || 0),
      points: Number(r.points || 0),
      status: r.status as "finished" | "abandoned",
    })),
  };
}
