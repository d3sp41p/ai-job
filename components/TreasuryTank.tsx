"use client";

import { hourlyPayroll, PAYOUTS_PER_DAY, salaryPool, SALARY_POOL_SHARE } from "@/lib/config";

// Illustration of the payroll: fees pour into the treasury tank, the top 20% is the
// salary pool, and a tap releases 1/96 of the pool every 15 minutes to the employees.
export default function TreasuryTank({ treasurySol }: { treasurySol: number }) {
  const pool = salaryPool(treasurySol);
  const hour = hourlyPayroll(treasurySol);

  // tank geometry
  const x = 70, y = 70, w = 170, h = 230;
  const level = 0.82; // liquid height share (illustrative)
  const liquidTop = y + h * (1 - level);
  const poolBottom = liquidTop + h * level * SALARY_POOL_SHARE;

  return (
    <svg viewBox="0 0 480 430" className="w-full h-auto" role="img"
      aria-label={`Treasury ${treasurySol} SOL. Salary pool ${pool.toFixed(2)} SOL. Paid out ${hour.toFixed(3)} SOL every 15 minutes.`}>
      <defs>
        <pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="9" height="9" fill="#F1E05A" />
          <line x1="0" y1="0" x2="0" y2="9" stroke="#0A0B09" strokeWidth="3" opacity="0.5" />
        </pattern>
        <clipPath id="tank-inside">
          <rect x={x + 3} y={y + 3} width={w - 6} height={h - 6} rx="10" />
        </clipPath>
      </defs>

      {/* inflow: creator fees */}
      <g>
        <text x={x + w / 2} y="20" textAnchor="middle" fontSize="15" fontWeight="600" fill="#EEECE2">Creator fees, 100%</text>
        <rect x={x + w / 2 - 10} y="28" width="20" height="30" fill="#EEECE2" />
        {[0, 1, 2].map((i) => (
          <circle key={i} className="tank-coin" cx={x + w / 2} cy="62" r="7" fill="#F1E05A" stroke="#0A0B09" strokeWidth="2.5"
            style={{ animationDelay: `${i * 0.6}s` }} />
        ))}
      </g>

      {/* liquid */}
      <g clipPath="url(#tank-inside)">
        <rect x={x} y={liquidTop} width={w} height={h} fill="#F1E05A" />
        <rect x={x} y={liquidTop} width={w} height={poolBottom - liquidTop} fill="url(#hatch)" />
        <path className="tank-wave" d={`M${x - 120} ${liquidTop} q 20 -7 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 V ${liquidTop + 12} H ${x - 120} Z`} fill="#F1E05A" />
      </g>
      {/* tank */}
      <rect x={x} y={y} width={w} height={h} rx="12" fill="none" stroke="#EEECE2" strokeWidth="4" />

      {/* labels */}
      <g fontSize="15" fill="#EEECE2">
        <line x1={x + w + 8} y1={(liquidTop + poolBottom) / 2} x2={x + w + 34} y2={(liquidTop + poolBottom) / 2} stroke="#EEECE2" strokeWidth="2" />
        <text x={x + w + 40} y={(liquidTop + poolBottom) / 2 - 4} fontWeight="700">Salary pool</text>
        <text x={x + w + 40} y={(liquidTop + poolBottom) / 2 + 15} fill="#9B9E92">{Math.round(SALARY_POOL_SHARE * 100)}% of treasury</text>
        <text x={x + w + 40} y={(liquidTop + poolBottom) / 2 + 34} fontWeight="700">{pool.toFixed(2)} SOL</text>

        <line x1={x + w + 8} y1={y + h * 0.72} x2={x + w + 34} y2={y + h * 0.72} stroke="#EEECE2" strokeWidth="2" />
        <text x={x + w + 40} y={y + h * 0.72 - 4} fontWeight="700">Treasury</text>
        <text x={x + w + 40} y={y + h * 0.72 + 15} fill="#9B9E92">all fees so far</text>
        <text x={x + w + 40} y={y + h * 0.72 + 34} fontWeight="700">{treasurySol.toFixed(1)} SOL</text>
      </g>

      {/* tap and drops */}
      <rect x={x + w / 2 - 9} y={y + h} width="18" height="26" fill="#EEECE2" />
      <rect x={x + w / 2 - 28} y={y + h + 18} width="56" height="12" rx="3" fill="#EEECE2" />
      {[0, 1].map((i) => (
        <path key={i} className="tank-drop" d={`M${x + w / 2} ${y + h + 36} q -6 10 0 14 q 6 -4 0 -14 Z`} fill="#F1E05A" stroke="#0A0B09" strokeWidth="2"
          style={{ animationDelay: `${i * 0.9}s` }} />
      ))}
      <g fontSize="15" fill="#EEECE2">
        <text x={x + w / 2 + 40} y={y + h + 54} fontWeight="700">Every 15 minutes: 1/{PAYOUTS_PER_DAY} of the pool</text>
        <text x={x + w / 2 + 40} y={y + h + 74} fill="#9B9E92">{hour.toFixed(3)} SOL, split by points</text>
      </g>
    </svg>
  );
}
