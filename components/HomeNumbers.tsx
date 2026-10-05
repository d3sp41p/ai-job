"use client";

import CountUp from "./CountUp";
import { salaryPool } from "@/lib/config";
import { useStats } from "@/lib/stats";

// Four live numbers on the home page
export default function HomeNumbers() {
  const s = useStats();
  return (
    <dl className="grid grid-cols-2 sheet">
      {([
        ["Treasury", <CountUp key="a" value={s.treasurySol} decimals={2} suffix=" SOL" />],
        ["Salary pool", <CountUp key="b" value={salaryPool(s.treasurySol)} decimals={3} suffix=" SOL" />],
        ["Paid to humans", <CountUp key="c" value={s.totalPaidSol} decimals={2} suffix=" SOL" />],
        ["Employees", <CountUp key="d" value={s.workers} />],
      ] as [string, React.ReactNode][]).map(([k, v], i) => (
        <div key={k} className={`p-5 ${i % 2 ? "border-l border-rule" : ""} ${i > 1 ? "border-t border-rule" : ""}`}>
          <dt className="text-sm text-inksoft">{k}</dt>
          <dd className="font-condensed text-4xl font-extrabold mt-1">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
