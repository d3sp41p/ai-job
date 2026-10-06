// All tunable numbers live here. Change them, the whole site follows.

export const TOKEN_NAME = "AI Gave Me a Job";
export const TOKEN_TICKER = process.env.NEXT_PUBLIC_TOKEN_TICKER || "$HIRED"; // set NEXT_PUBLIC_TOKEN_TICKER after launch
// the coin's pump.fun page; the "Buy" buttons appear once it is set (NEXT_PUBLIC_BUY_URL in Vercel)
export const BUY_URL = (process.env.NEXT_PUBLIC_BUY_URL || "").trim();

export type Difficulty = "easy" | "medium" | "hard";

// Break between shifts: 10 minutes (team decision 2026-10-06), 0 = no break. Set NEXT_PUBLIC_COOLDOWN_MINUTES in Vercel to bring it back.
export const COOLDOWN_MINUTES = Math.max(0, Number(process.env.NEXT_PUBLIC_COOLDOWN_MINUTES ?? 10) || 0);
export const HAS_COOLDOWN = COOLDOWN_MINUTES > 0;
/** "every 30 minutes" / "any time" for site copy */
export const SHIFT_PACE = HAS_COOLDOWN ? `every ${COOLDOWN_MINUTES} minutes` : "any time, no breaks";
export const TOTAL_SUPPLY = 1_000_000_000; // pump.fun coins have 1B supply
export const MIN_HOLD = TOTAL_SUPPLY * 0.0001; // 0.01% of supply = 100,000 tokens
export const MIN_CLAIM_SOL = Number(process.env.NEXT_PUBLIC_MIN_CLAIM_SOL) || 0.001; // smallest payout sent
// Safety limits for automatic payouts. Tiny while testing on mainnet; raise them before launch
// (or set MAX_PAYOUT_SOL / DAILY_PAYOUT_CAP_SOL in Vercel to override without a code change).
export const MAX_PAYOUT_SOL = Number(process.env.MAX_PAYOUT_SOL) || 0.02; // one address, one payout
export const DAILY_PAYOUT_CAP_SOL = Number(process.env.DAILY_PAYOUT_CAP_SOL) || 0.05; // all payouts, last 24 hours
export const PAYOUTS_PER_TX = 16; // transfers packed into one transaction
export const UNCLAIMED_EXPIRY_DAYS = 30;

// ---- Anti-abuse ----
export const MAX_ADDRESSES_PER_DEVICE = 2; // different payroll addresses one device may use in 24h
export const MAX_ADDRESSES_PER_IP = 4; // same, per network (a bit higher: homes, offices, mobile carriers share IPs)
export const LOCK_NONCE_MINUTES = 5; // a "Lock my address" signature request expires after this
export const SHIFTS_PER_IP = 6; // shifts one network may start per cooldown window
export const SHIFT_EXPIRES_MINUTES = 10; // a started shift must be handed in within this time
// fastest believable shift (from start to result); faster results are rejected
export const MIN_SHIFT_SECONDS: Record<"easy" | "medium" | "hard", number> = { easy: 3, medium: 6, hard: 8 };

// ---- Guests ----
export const PENDING_MINUTES = 15; // a guest's passed shift waits this long for an address
export const GUEST_WINDOW_MINUTES = 30; // only the first passed guest shift in this window can be paid

// ---- Economy ----
// 100% of creator fees go to the treasury. Nothing goes to the team.
// Share of the treasury paid out per day. 0.25 since 2026-10-06. Override: NEXT_PUBLIC_SALARY_POOL_SHARE.
export const SALARY_POOL_SHARE = Number(process.env.NEXT_PUBLIC_SALARY_POOL_SHARE) || 0.25;
// Payroll rounds: the pool is paid out in slices every PAYROLL_MINUTES (team decision 2026-10-06: 15).
// The database buckets shifts into the same periods (payroll_period() in 0006_payroll_15min.sql) — change both together.
export const PAYROLL_MINUTES = 15;
export const PERIOD_MS = PAYROLL_MINUTES * 60_000;
export const PAYOUTS_PER_DAY = (24 * 60) / PAYROLL_MINUTES; // 96 slices a day
export const periodStart = (ms: number) => Math.floor(ms / PERIOD_MS) * PERIOD_MS;
export const PAID_SHIFTS_PER_DAY = 12; // full pay for the first 12 shifts in 24 hours
export const OVERTIME_RATE = 0.25; // shifts after that earn 25% of points
export const WALLET_HOURLY_CAP = Number(process.env.NEXT_PUBLIC_WALLET_HOURLY_CAP) || 0.5; // one wallet takes at most 50% of a payroll round
export const QUALITY_THRESHOLD = 0.5; // performance below 50% earns nothing

export function salaryPool(treasurySol: number) {
  return treasurySol * SALARY_POOL_SHARE;
}
export function hourlyPayroll(treasurySol: number) {
  return salaryPool(treasurySol) / PAYOUTS_PER_DAY;
}
// Your SOL for this hour: your share of the slice, capped
export function hourlyPay(treasurySol: number, myPoints: number, everyonePoints: number) {
  const slice = hourlyPayroll(treasurySol);
  if (everyonePoints <= 0 || myPoints <= 0) return 0;
  return Math.min(slice * (myPoints / everyonePoints), slice * WALLET_HOURLY_CAP);
}

export const BASE_POINTS: Record<Difficulty, number> = {
  easy: 10,
  medium: 25,
  hard: 60,
};

export const DIFFICULTY_INFO: Record<
  Difficulty,
  { label: string; shift: string; duration: string; blurb: string }
> = {
  easy: {
    label: "Easy",
    shift: "Part-time",
    duration: "15–30 sec",
    blurb: "Office chores. The AI barely notices you exist.",
  },
  medium: {
    label: "Medium",
    shift: "Full-time",
    duration: "30–60 sec",
    blurb: "Hands-on work. Mild supervision applies.",
  },
  hard: {
    label: "Hard",
    shift: "Overtime",
    duration: "60–120 sec",
    blurb: "Skilled work under pressure. Pays like it means it.",
  },
};

// Holding tiers: balance → multiplier. Grows slower than the balance, capped at 3x.
// Uses the LOWEST balance seen during the last 24 hours.
export const HOLD_TIERS = [
  { min: 100_000, multiplier: 1.0 },
  { min: 250_000, multiplier: 1.3 },
  { min: 500_000, multiplier: 1.6 },
  { min: 1_000_000, multiplier: 2.0 },
  { min: 2_500_000, multiplier: 2.4 },
  { min: 5_000_000, multiplier: 3.0 },
];

// Streak: days held → multiplier (capped at 1.5)
export function streakMultiplier(daysHeld: number): number {
  return Math.min(1.5, 1 + daysHeld * 0.05);
}

export function holdMultiplier(balance: number): number {
  let m = 0;
  for (const t of HOLD_TIERS) if (balance >= t.min) m = t.multiplier;
  return m;
}

export function computePoints(
  difficulty: Difficulty,
  performance: number,
  balance: number,
  daysHeld: number,
  shiftsToday = 0 // shifts already worked in the last 24 hours
) {
  const base = BASE_POINTS[difficulty];
  const hold = holdMultiplier(balance);
  const streak = streakMultiplier(daysHeld);
  const passed = performance >= QUALITY_THRESHOLD;
  const overtime = shiftsToday >= PAID_SHIFTS_PER_DAY;
  const rate = overtime ? OVERTIME_RATE : 1;
  const total = passed ? Math.round(base * performance * hold * streak * rate * 10) / 10 : 0;
  return { base, performance, hold, streak, rate, overtime, passed, total };
}

// Career ladder: completed assignments → rank
export const RANKS = [
  { min: 0, title: "Intern" },
  { min: 10, title: "Junior Data Labeler" },
  { min: 30, title: "Prompt Operator" },
  { min: 75, title: "Senior AI Servant" },
  { min: 150, title: "Human Resources Manager" },
  { min: 300, title: "Right Hand of the AI" },
];

export function rankFor(tasksCompleted: number) {
  let idx = 0;
  RANKS.forEach((r, i) => {
    if (tasksCompleted >= r.min) idx = i;
  });
  const next = RANKS[idx + 1];
  return { index: idx, title: RANKS[idx].title, min: RANKS[idx].min, next };
}
