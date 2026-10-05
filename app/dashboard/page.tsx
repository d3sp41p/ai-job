"use client";

import Link from "next/link";
import { shortAddr } from "@/lib/mock";
import { useStats } from "@/lib/stats";
import CountUp from "@/components/CountUp";
import { formatDuration, timeAgo, useNow } from "@/components/useNow";
import TreasuryChart from "@/components/TreasuryChart";
import { hourlyPayroll, salaryPool, SALARY_POOL_SHARE } from "@/lib/config";

const solscan = (path: string) => `https://solscan.io/${path}`;

export default function DashboardPage() {
  const now = useNow();
  const STATS = useStats();
  const TREASURY_ADDRESS = STATS.treasuryAddress;
  const PAYOUT_ADDRESS = STATS.payoutAddress;
  const nextHour = Math.ceil((now + 1) / 3_600_000) * 3_600_000;
  const pool = salaryPool(STATS.treasurySol);
  const slice = hourlyPayroll(STATS.treasurySol);
  const hist = STATS.treasuryHistory;
  const weekGrowth = hist[hist.length - 1] - hist[Math.max(0, hist.length - 8)];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <h1 className="font-condensed text-6xl md:text-7xl font-black leading-[0.9]">Payroll</h1>
      <p className="mt-3 max-w-xl text-inksoft">
        100% of creator fees go to the employees. Here is every SOL: what&rsquo;s in the treasury, what&rsquo;s being paid
        this hour, and every salary ever sent.
      </p>

      {/* Treasury hero */}
      <section className="mt-8 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 items-stretch">
        <div className="glow p-5 sm:p-7 min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-ink/60">Treasury</p>
            <p className="text-sm text-marker">+{weekGrowth.toFixed(1)} SOL this week</p>
          </div>
          <p className="font-condensed text-[clamp(4rem,11vw,7.5rem)] font-black leading-none mt-1">
            <CountUp value={STATS.treasurySol} decimals={1} suffix=" SOL" />
          </p>
          <div className="mt-4 text-ink">
            <TreasuryChart data={hist} height={150} areaOpacity={0.9} />
          </div>
        </div>
        <div className="grid gap-6">
          <div className="sheet p-5 sm:p-6">
            <p className="text-sm text-inksoft">Salary pool ({Math.round(SALARY_POOL_SHARE * 100)}% of treasury)</p>
            <p className="font-condensed text-5xl font-black mt-1">
              <CountUp value={pool} decimals={2} suffix=" SOL" />
            </p>
            <p className="text-sm text-inksoft mt-1">Paid out over the next 24 hours, one slice every hour.</p>
          </div>
          <div className="rounded-[20px] p-5 sm:p-6 bg-marker text-paper">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm">This hour&rsquo;s payroll</p>
              <p className="text-sm">
                Paid in{" "}
                <span translate="no" className="font-semibold tabular-nums">
                  {now ? formatDuration(nextHour - now) : "--:--"}
                </span>
              </p>
            </div>
            <p className="font-condensed text-5xl font-black mt-1" translate="no">
              {slice.toFixed(3)} SOL
            </p>
            <p className="text-sm mt-1">{STATS.workersThisHour} employees on shift right now.</p>
          </div>
        </div>
      </section>

      {/* Totals */}
      <dl className="mt-6 sheet grid grid-cols-2 lg:grid-cols-4">
        {([
          ["Paid to humans", <CountUp key="a" value={STATS.totalPaidSol} decimals={2} suffix=" SOL" />],
          ["Salaries sent", <CountUp key="b" value={STATS.payouts} />],
          ["Employees", <CountUp key="c" value={STATS.workers} />],
          ["Assignments done", <CountUp key="d" value={STATS.tasksDone} />],
        ] as [string, React.ReactNode][]).map(([k, v], i) => (
          <div
            key={k}
            className={`p-5 ${i > 0 ? "lg:border-l" : ""} ${i % 2 ? "border-l" : ""} ${
              i > 1 ? "border-t lg:border-t-0" : ""
            } border-rule`}
          >
            <dt className="text-sm text-inksoft">{k}</dt>
            <dd className="font-condensed text-4xl sm:text-5xl font-black mt-1">{v}</dd>
          </div>
        ))}
      </dl>

      {/* Wallets */}
      <section className="mt-6 sheet p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-condensed text-3xl font-black">Company wallets</h2>
          <p className="text-sm text-inksoft">
            Fees earned all time: <span className="font-semibold text-ink">{STATS.feesAllTimeSol} SOL</span>. Team cut: 0.
          </p>
        </div>
        <dl className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-sm text-inksoft">Treasury: receives 100% of creator fees from pump.fun</dt>
            <dd>
              <a className="underline underline-offset-4 break-all" href={solscan(`account/${TREASURY_ADDRESS}`)} target="_blank" rel="noreferrer">
                {TREASURY_ADDRESS}
              </a>
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-sm text-inksoft">Pay wallet: sends salaries every hour</dt>
            <dd>
              <a className="underline underline-offset-4 break-all" href={solscan(`account/${PAYOUT_ADDRESS}`)} target="_blank" rel="noreferrer">
                {PAYOUT_ADDRESS}
              </a>
            </dd>
          </div>
        </dl>
      </section>

      {/* Leaderboard + payouts */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr] items-start [&>*]:min-w-0">
        <section className="sheet">
          <h2 className="px-5 pt-5 font-condensed text-3xl font-black">Top employees today</h2>
          <div className="overflow-x-auto">
            <table className="mt-3 w-full text-left text-[15px]">
              <thead className="text-sm text-inksoft border-b border-rule">
                <tr>
                  <th className="font-normal pl-5 pr-2 py-2">Place</th>
                  <th className="font-normal px-2 py-2">Employee</th>
                  <th className="font-normal px-2 py-2">Title</th>
                  <th className="font-normal px-5 py-2 text-right">Points</th>
                </tr>
              </thead>
              <tbody>
                {STATS.leaderboard.map((r, i) => (
                  <tr key={r.address} className={`border-b border-rule last:border-0 ${i === 0 ? "bg-marker/10 text-marker" : ""}`}>
                    <td className="pl-5 pr-2 py-2.5 font-semibold">{i + 1}</td>
                    <td className="px-2 py-2.5">
                      <Link href={`/resume/?address=${r.address}`} className="underline underline-offset-4">
                        {r.name ? `${r.name} · ${shortAddr(r.address)}` : shortAddr(r.address)}
                      </Link>
                    </td>
                    <td className="px-2 py-2.5 whitespace-nowrap">{r.rank}</td>
                    <td className="px-5 py-2.5 text-right font-semibold">{r.points.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="sheet">
          <h2 className="px-5 pt-5 font-condensed text-3xl font-black">Latest salaries</h2>
          <ul className="mt-3">
            {STATS.recentPayouts.map((p) => (
              <li key={p.tx} className="px-5 py-2.5 border-t border-rule flex items-baseline justify-between gap-3 text-[15px]">
                <span>
                  <span className="font-semibold">{p.amountSol} SOL</span>
                  <span className="text-inksoft"> to {shortAddr(p.address)}</span>
                </span>
                <a href={solscan(`tx/${p.tx}`)} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-4 whitespace-nowrap">
                  {timeAgo(p.at, now)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
