// SOL amounts: more decimals for small numbers, so 0.009 doesn't show as 0.0
export function solDecimals(n: number) {
  const a = Math.abs(n);
  if (a >= 100) return 0;
  if (a >= 10) return 1;
  if (a >= 1) return 2;
  return 3;
}

export const fmtSol = (n: number) => n.toFixed(solDecimals(n));

/** a round number just above v, for chart scales (0.0123 -> 0.02, 47 -> 50) */
export function niceMax(v: number) {
  if (!(v > 0)) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / mag) * mag;
}
