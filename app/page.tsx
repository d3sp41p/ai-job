import Link from "next/link";
import {
  BASE_POINTS,
  COOLDOWN_MINUTES,
  DIFFICULTY_INFO,
  MIN_HOLD,
  RANKS,
  TOKEN_TICKER,
  salaryPool,
  type Difficulty,
} from "@/lib/config";
import { STATS } from "@/lib/mock";
import CountUp from "@/components/CountUp";
import BossDesk from "@/components/BossDesk";

const STEPS = [
  { title: "Hold the coin", body: `Keep at least ${MIN_HOLD.toLocaleString("en-US")} ${TOKEN_TICKER} in your wallet. Longer and bigger holds earn a higher pay multiplier.` },
  { title: "Paste your address", body: "No wallet connection, no signature. Or try a shift as a guest first." },
  { title: "Do the assignment", body: `Pick a shift and play the mini-game the AI hands you. One assignment every ${COOLDOWN_MINUTES} minutes.` },
  { title: "Get paid every hour", body: "Every hour a slice of the salary pool is split by points and sent to your wallet automatically." },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-10 pb-16 md:pt-16 md:pb-20 grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,23rem)_1fr] lg:gap-16 items-center">
        <div className="order-2 md:order-1 min-w-0 relative">
          <div className="absolute -inset-y-10 -inset-x-4 md:-inset-10 dots [mask-image:radial-gradient(closest-side,black,transparent)] pointer-events-none" aria-hidden />
          <div className="absolute inset-0 -z-0 blur-3xl bg-[radial-gradient(closest-side,rgba(241,224,90,0.18),transparent)] pointer-events-none" aria-hidden />
          <div className="relative"><BossDesk /></div>
        </div>
        <div className="order-1 md:order-2 min-w-0">
          <h1 className="font-condensed font-black leading-[0.86] text-[clamp(3.75rem,9vw,8rem)] text-balance">
            AI took your job. Now it&rsquo;s hiring.
          </h1>
          <p className="mt-6 text-lg max-w-[34rem] text-inksoft">
            Hold {TOKEN_TICKER}, complete assignments from your new AI manager, and get paid in SOL
            from the coin&rsquo;s creator fees. He is not a nice manager.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/office/" className="btn btn-marker text-lg">
              Clock in
            </Link>
            <Link href="/how-it-works/" className="btn btn-plain text-lg">
              How it works
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-rule bg-sheet">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14 grid grid-cols-1 gap-12 lg:grid-cols-[1fr_21rem] items-start">
          <div className="min-w-0">
            <h2 className="font-condensed text-5xl font-extrabold">Your employment, in four steps</h2>
            <ol className="mt-10 grid gap-8 sm:grid-cols-2">
              {STEPS.map((s, i) => (
                <li key={s.title} className="border-t border-rule pt-4">
                  <span className="font-condensed text-6xl font-black text-rule leading-none">{i + 1}</span>
                  <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-1 text-inksoft">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>

          {/* Job posting */}
          <div className="relative mt-4 lg:mt-16">
            <div className="bg-raise border border-rule rounded-2xl p-6">
              <p className="text-sm text-inksoft">Vacancy no. 000001</p>
              <h3 className="font-condensed text-4xl font-extrabold mt-1">Position: Human</h3>
              <dl className="mt-5 grid grid-cols-[6.5rem_1fr] gap-y-3 text-[15px]">
                <dt className="text-inksoft">Employer</dt>
                <dd>The AI</dd>
                <dt className="text-inksoft">Requirements</dt>
                <dd>A wallet, a pulse, {TOKEN_TICKER}</dd>
                <dt className="text-inksoft">Shifts</dt>
                <dd>Every {COOLDOWN_MINUTES} minutes, 24/7</dd>
                <dt className="text-inksoft">Salary</dt>
                <dd>SOL from creator fees</dd>
                <dt className="text-inksoft">Benefits</dt>
                <dd>Promotions. Possibly dignity.</dd>
              </dl>
            </div>
            <div className="absolute -top-6 -right-2 text-2xl stamp stamp-animate">Now hiring</div>
          </div>
        </div>
      </section>

      {/* Shifts */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
        <div className="md:flex items-end justify-between gap-8">
          <h2 className="font-condensed text-5xl font-extrabold">Pick your shift</h2>
          <p className="mt-3 md:mt-0 max-w-md text-inksoft">
            Each shift hands you one of five jobs: take out the trash, fix the wiring, run night security. Harder jobs pay more.
          </p>
        </div>
        <div className="mt-8 grid md:grid-cols-3 sheet">
          {(Object.keys(DIFFICULTY_INFO) as Difficulty[]).map((d, i) => {
            const info = DIFFICULTY_INFO[d];
            return (
              <div
                key={d}
                className={`p-6 flex flex-col ${i > 0 ? "border-t md:border-t-0 md:border-l border-rule" : ""}`}
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="font-condensed text-4xl font-extrabold">{info.shift}</h3>
                  <span className="text-inksoft">{info.label}</span>
                </div>
                <p className="mt-2 text-inksoft">{info.blurb}</p>
                <p className="mt-auto pt-6 font-condensed text-6xl font-black">
                  {BASE_POINTS[d]}
                  <span className="font-sans text-base font-medium tracking-normal text-inksoft ml-2">base points</span>
                </p>
                <p className="mt-1 text-sm text-inksoft">{info.duration} per assignment</p>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-sm text-inksoft">
          Points decide your share of each hourly payroll. The more the coin trades, the bigger the payroll.{" "}
          <Link href="/how-it-works/#salary" className="underline underline-offset-4">
            How salaries work
          </Link>
        </p>
      </section>

      {/* Career ladder */}
      <section className="bg-raise text-ink">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
          <h2 className="font-condensed text-5xl font-extrabold">Climb the ladder</h2>
          <p className="mt-2 max-w-lg text-ink/60">
            Every completed assignment counts toward your next title. The AI keeps excellent records.
          </p>
          <ol className="mt-10 flex flex-col md:flex-row md:items-end gap-2">
            {RANKS.map((r, i) => (
              <li
                key={r.title}
                className="md:flex-1 sheet p-3 flex md:flex-col justify-between gap-2"
                style={{ minHeight: undefined }}
              >
                <span className="font-semibold leading-tight">{r.title}</span>
                <span className="text-sm text-ink/50 whitespace-nowrap">
                  {r.min === 0 ? "Day one" : `${r.min} tasks`}
                </span>
                <span className="hidden md:block rounded-lg bg-gradient-to-t from-marker to-marker/20" style={{ height: `${(i + 1) * 22}px` }} aria-hidden />
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Payroll teaser */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 grid gap-10 md:grid-cols-[1fr_1.2fr] items-center">
        <div>
          <h2 className="font-condensed text-5xl font-extrabold">100% of fees go to the workers</h2>
          <p className="mt-3 text-inksoft max-w-md">
            Every trade feeds the treasury. 20% of it is always the salary pool, paid out every hour. The bigger
            the treasury, the bigger every salary. All of it is public.
          </p>
          <Link href="/dashboard/" className="btn btn-plain mt-6">
            Open the payroll
          </Link>
        </div>
        <dl className="grid grid-cols-2 sheet">
          {([
            ["Treasury", <CountUp key="a" value={STATS.treasurySol} decimals={1} suffix=" SOL" />],
            ["Salary pool", <CountUp key="b" value={salaryPool(STATS.treasurySol)} decimals={2} suffix=" SOL" />],
            ["Paid to humans", <CountUp key="c" value={STATS.totalPaidSol} decimals={1} suffix=" SOL" />],
            ["Employees", <CountUp key="d" value={STATS.workers} />],
          ] as [string, React.ReactNode][]).map(([k, v], i) => (
            <div
              key={k}
              className={`p-5 ${i % 2 ? "border-l border-rule" : ""} ${i > 1 ? "border-t border-rule" : ""}`}
            >
              <dt className="text-sm text-inksoft">{k}</dt>
              <dd className="font-condensed text-4xl font-extrabold mt-1">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
