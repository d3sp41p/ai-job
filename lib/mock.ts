// Preview data. Replaced by Supabase + Helius in later stages.

export const TREASURY_ADDRESS = "TreAsury1111111111111111111111111111111111";
export const PAYOUT_ADDRESS = "PayouT11111111111111111111111111111111111";

export function shortAddr(a: string) {
  return a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

export function fakeAddress(seed: number) {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let s = seed * 9301 + 49297;
  let out = "";
  for (let i = 0; i < 44; i++) {
    s = (s * 9301 + 49297) % 233280;
    out += chars[s % chars.length];
  }
  return out;
}

export const STATS = {
  treasurySol: 48.6, // live balance of the treasury in production
  totalPaidSol: 184.62,
  payouts: 1291,
  workers: 642,
  tasksDone: 18_430,
  feesAllTimeSol: 233.2,
  hourPoints: 1450, // points earned by everyone in the current hour
  workersThisHour: 57,
  // treasury balance over the last 14 days, for the growth chart
  treasuryHistory: [3.1, 6.4, 9.8, 12.2, 15.9, 18.4, 22.7, 25.1, 29.6, 33.0, 36.8, 41.2, 44.9, 48.6],
};

export const LEADERBOARD = [
  { address: fakeAddress(1), rank: "Human Resources Manager", tasks: 212, points: 1840.5 },
  { address: fakeAddress(2), rank: "Senior AI Servant", tasks: 141, points: 1522.0 },
  { address: fakeAddress(3), rank: "Senior AI Servant", tasks: 98, points: 1310.2 },
  { address: fakeAddress(4), rank: "Prompt Operator", tasks: 66, points: 990.0 },
  { address: fakeAddress(5), rank: "Prompt Operator", tasks: 51, points: 874.4 },
  { address: fakeAddress(6), rank: "Junior Data Labeler", tasks: 27, points: 611.8 },
  { address: fakeAddress(7), rank: "Junior Data Labeler", tasks: 19, points: 498.3 },
  { address: fakeAddress(8), rank: "Intern", tasks: 8, points: 301.0 },
];

export const RECENT_PAYOUTS = Array.from({ length: 8 }, (_, i) => ({
  address: fakeAddress(20 + i),
  amountSol: Math.round((0.02 + ((i * 37) % 11) / 20) * 1000) / 1000,
  minutesAgo: 3 + i * 7,
  tx: fakeAddress(100 + i) + fakeAddress(200 + i).slice(0, 44),
}));

export function mockResume(address: string) {
  let h = 0;
  for (const c of address) h = (h * 31 + c.charCodeAt(0)) % 100000;
  return {
    address,
    daysHeld: (h % 40) + 1,
    tasks: h % 180,
    earnedSol: Math.round((h % 900) / 10) / 100,
    balance: 100_000 + (h % 50) * 120_000,
  };
}
