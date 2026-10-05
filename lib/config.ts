// All tunable numbers live here. Change them, the whole site follows.

export const TOKEN_NAME = "AI Gave Me a Job";
export const TOKEN_TICKER = "$HIRED"; // placeholder until the coin is launched

export type Difficulty = "easy" | "medium" | "hard";

export const COOLDOWN_MINUTES = 30;
export const TOTAL_SUPPLY = 1_000_000_000; // pump.fun coins have 1B supply
export const MIN_HOLD = TOTAL_SUPPLY * 0.0001; // 0.01% of supply = 100,000 tokens
export const MIN_CLAIM_SOL = 0.01;
export const UNCLAIMED_EXPIRY_DAYS = 30;

// ---- Anti-abuse ----
export const MAX_ADDRESSES_PER_DEVICE = 2; // different payroll addresses one device may use in 24h
export const MAX_ADDRESSES_PER_IP = 4; // same, per network (a bit higher: homes, offices, mobile carriers share IPs)
export const LOCK_NONCE_MINUTES = 5; // a "Lock my address" signature request expires after this

// ---- Economy ----
// 100% of creator fees go to the treasury. Nothing goes to the team.
export const SALARY_POOL_SHARE = 0.2; // salary pool is always 20% of the treasury
export const PAYOUTS_PER_DAY = 24; // the pool is paid out in hourly slices: 1/24 each hour
export const PAID_SHIFTS_PER_DAY = 12; // full pay for the first 12 shifts in 24 hours
export const OVERTIME_RATE = 0.25; // shifts after that earn 25% of points
export const WALLET_HOURLY_CAP = 0.05; // one wallet takes at most 5% of an hourly slice
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
