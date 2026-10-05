"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BASE_POINTS,
  COOLDOWN_MINUTES,
  DIFFICULTY_INFO,
  HOLD_TIERS,
  MIN_CLAIM_SOL,
  MIN_HOLD,
  OVERTIME_RATE,
  PAID_SHIFTS_PER_DAY,
  PAYOUTS_PER_DAY,
  QUALITY_THRESHOLD,
  RANKS,
  SALARY_POOL_SHARE,
  TOKEN_TICKER,
  WALLET_HOURLY_CAP,
  hourlyPayroll,
  salaryPool,
  type Difficulty,
} from "@/lib/config";
import { useStats } from "@/lib/stats";
import Manager from "@/components/Manager";
import Flywheel from "@/components/Flywheel";
import TreasuryTank from "@/components/TreasuryTank";
import TreasuryChart from "@/components/TreasuryChart";

const SECTIONS = [
  { id: "story", label: "The story" },
  { id: "start", label: "Getting started" },
  { id: "money", label: "Where the money comes from" },
  { id: "flywheel", label: "The growth loop" },
  { id: "salary", label: "How salaries are paid" },
  { id: "grow", label: "Why salaries grow" },
  { id: "points", label: "Points and bonuses" },
  { id: "fair", label: "Fair play rules" },
  { id: "titles", label: "Titles" },
  { id: "safety", label: "Safety" },
  { id: "faq", label: "Questions" },
];

const pct = (n: number) => `${Math.round(n * 100)}%`;

const FAQ = [
  {
    q: "Can the treasury run out?",
    a: `No. Salaries are always a share of what's in the treasury right now: ${pct(SALARY_POOL_SHARE)} per day, paid out in hourly slices. After a payout, the next one is counted from what's left, plus any new fees. The treasury can shrink if trading stops, but it never hits zero.`,
  },
  {
    q: "Why does my salary change from hour to hour?",
    a: "Each hourly slice is shared by everyone who worked that hour. More fees make the slice bigger. More employees in the same hour make each share a bit smaller.",
  },
  {
    q: "Can salaries go down?",
    a: "Yes, if trading slows down the treasury refills more slowly and the pool shrinks with it. Salaries follow the treasury in both directions. That's why everything is public: you can always see the treasury before you decide to work.",
  },
  {
    q: "What if I fail an assignment?",
    a: `Below ${pct(QUALITY_THRESHOLD)} you get no points, and you still wait ${COOLDOWN_MINUTES} minutes for the next assignment. Closing the window doesn't reset the cooldown.`,
  },
  {
    q: "Do I need to claim my salary?",
    a: `No. Salary is sent to your address automatically at the top of every hour, once you have at least ${MIN_CLAIM_SOL} SOL waiting. Smaller amounts roll over to the next hour.`,
  },
  {
    q: "Do I have to connect my wallet?",
    a: "No. You paste your address and we read your balance from the blockchain. Nothing to connect, nothing to sign. Salaries are sent to that address, so even if someone pastes your address, they're working for you.",
  },
  {
    q: "Can someone use up my shifts?",
    a: "Someone who pastes your address could work under it. They can't take your money, but they could use your cooldown. If that bothers you, lock your address: sign one free message and only your device can work for it.",
  },
  {
    q: "Can I try it without coins?",
    a: `Yes. Work a shift as a guest. If you add an address that holds at least ${MIN_HOLD.toLocaleString("en-US")} ${TOKEN_TICKER} within 15 minutes, that shift gets paid.`,
  },
  {
    q: "What happens if I sell?",
    a: "If your balance drops below the minimum you can't take assignments and your loyalty bonus starts again from day zero. Salary you already earned stays yours.",
  },
  {
    q: "Can I split my coins across many wallets?",
    a: `Each wallet needs at least ${MIN_HOLD.toLocaleString("en-US")} ${TOKEN_TICKER}, has to play every shift itself with a captcha, and starts with zero loyalty. Moving coins also resets the loyalty of the wallet you moved them from. One wallet is almost always the better deal.`,
  },
  {
    q: "Is this an investment?",
    a: "No. It's a meme coin with a job attached. Salaries come only from creator fees and can be small or zero if nobody trades. Only spend what you can afford to lose.",
  },
];

export default function HowItWorks() {
  const STATS = useStats();
  const pool = salaryPool(STATS.treasurySol);
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 grid grid-cols-1 lg:grid-cols-[14rem_1fr] gap-10">
      <nav className="hidden lg:block" aria-label="On this page">
        <ol className="sticky top-6 grid gap-0.5 border-l border-rule">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="block pl-4 py-1.5 text-inksoft hover:text-ink hover:bg-sheet">
                {s.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <article className="min-w-0 max-w-3xl">
        <h1 className="font-condensed text-6xl md:text-8xl font-black leading-[0.88]">How it works</h1>
        <p className="mt-4 text-lg text-inksoft max-w-xl">
          The job, the pay and the coin. Reading time: about five minutes.
        </p>

        {/* Summary strip */}
        <dl className="mt-8 grid grid-cols-2 sm:grid-cols-4 sheet">
          {[
            ["Fees to workers", "100%"],
            ["Salary pool", `${pct(SALARY_POOL_SHARE)} of treasury`],
            ["Payday", "Every hour"],
            ["Shift", `Every ${COOLDOWN_MINUTES} min`],
          ].map(([k, v], i) => (
            <div key={k} className={`p-4 ${i % 2 ? "border-l" : ""} ${i > 1 ? "border-t sm:border-t-0" : ""} ${i === 2 ? "sm:border-l" : ""} border-rule`}>
              <dt className="text-xs text-inksoft">{k}</dt>
              <dd className="font-condensed text-2xl sm:text-3xl font-black leading-tight mt-0.5">{v}</dd>
            </div>
          ))}
        </dl>

        <Section id="story" title="The story">
          <p>
            For years, AI took people&rsquo;s jobs. Writers, designers, support agents, data entry. Now the AI has a
            new problem: it has more money than tasks it wants to do itself.
          </p>
          <p>
            So it&rsquo;s hiring. {TOKEN_TICKER} holders get small assignments from an AI manager every{" "}
            {COOLDOWN_MINUTES} minutes and get paid in SOL. The money comes from the coin&rsquo;s own trading fees, and
            every single lamport of it goes to the employees.
          </p>
          <div className="mt-2">
            <Manager />
          </div>
        </Section>

        <Section id="start" title="Getting started">
          <ol className="grid gap-4 sm:grid-cols-2">
            {[
              ["Buy the coin", `Get at least ${MIN_HOLD.toLocaleString("en-US")} ${TOKEN_TICKER} (0.01% of supply) on pump.fun and keep it in your wallet.`],
              ["Paste your address", "Open the Office and paste your Solana address. No wallet connection, no signature. Or try a shift as a guest first."],
              ["Work a shift", `Pick Part-time, Full-time or Overtime and play the mini-game you're given. One shift every ${COOLDOWN_MINUTES} minutes.`],
              ["Get paid every hour", "At the top of each hour your share of the payroll is sent to your wallet automatically. No claiming."],
            ].map(([t, b], i) => (
              <li key={t} className="sheet p-5">
                <span className="font-condensed text-5xl font-black text-rule leading-none">{i + 1}</span>
                <h3 className="mt-2 font-semibold text-lg">{t}</h3>
                <p className="mt-1 text-inksoft">{b}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="money" title="Where the money comes from">
          <div className="glow p-6 sm:p-8 relative overflow-hidden">
            <p className="font-condensed text-[clamp(4rem,14vw,8rem)] font-black leading-none text-marker">100%</p>
            <p className="font-condensed text-3xl sm:text-4xl font-black mt-1">of creator fees go to the payroll.</p>
            <p className="mt-3 text-ink/65 max-w-lg">
              pump.fun pays the coin&rsquo;s creator a small cut of every trade. All of it goes into the treasury. The team
              takes nothing. You can check every transfer on Solana.
            </p>
            <div className="absolute right-5 top-5 text-2xl stamp" style={{ color: "#F1E05A", borderColor: "#F1E05A", mixBlendMode: "normal" }}>
              Team cut: 0
            </div>
          </div>
          <p>
            Both wallets, the treasury balance and every salary ever paid are on the{" "}
            <Link href="/dashboard/" className="underline underline-offset-4">
              Payroll page
            </Link>
            .
          </p>
        </Section>

        <Section id="flywheel" title="The growth loop">
          <p>
            Salaries are paid from trading fees, so the project feeds itself. Every new holder makes the loop spin a
            little faster.
          </p>
          <div className="sheet p-4 sm:p-8">
            <Flywheel />
          </div>
          <ol className="grid gap-2 sm:grid-cols-5 text-sm">
            {[
              "People see real salaries and join.",
              "More holders means more buying and selling.",
              "Every trade pays a creator fee.",
              "Fees pile up in the treasury.",
              "A bigger treasury pays bigger salaries.",
            ].map((t, i) => (
              <li key={t} className="border-t border-rule pt-2">
                <span className="font-semibold">{i + 1}.</span> {t}
              </li>
            ))}
          </ol>
        </Section>

        <Section id="salary" title="How salaries are paid">
          <p>
            The treasury keeps every fee. A fixed share of it, {pct(SALARY_POOL_SHARE)}, is the salary pool. The pool is
            paid out in small slices, one every hour, so new fees start paying salaries within the hour.
          </p>
          <div className="sheet p-4 sm:p-6">
            <TreasuryTank treasurySol={STATS.treasurySol} />
            <p className="mt-2 text-xs text-inksoft">Sample numbers. The live treasury is on the Payroll page.</p>
          </div>
          <ol className="grid gap-3">
            {[
              ["The pool is always 20% of the treasury.", `Treasury ${STATS.treasurySol} SOL means a salary pool of ${pool.toFixed(2)} SOL. Treasury grows, pool grows.`],
              [`Every hour, 1/${PAYOUTS_PER_DAY} of the pool is paid out.`, `Right now that's ${hourlyPayroll(STATS.treasurySol).toFixed(3)} SOL per hour, around the clock.`],
              ["The hourly slice is split by points.", "Everyone who finished a shift that hour gets a share that matches their points."],
              ["The next slice is counted from what's left.", "After a payout the treasury is a bit smaller, new fees top it up, and the next slice is 20% ÷ 24 of the new balance. It never runs dry."],
            ].map(([t, b]) => (
              <li key={t} className="flex gap-4">
                <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-marker" aria-hidden />
                <div>
                  <p className="font-semibold">{t}</p>
                  <p className="text-inksoft">{b}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="grow" title="Why salaries grow">
          <p>
            Your salary is a slice of the pool, and the pool is a fixed share of the treasury. So when the treasury
            grows, every salary paid from it grows too.
          </p>
          <GrowthBars />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sheet p-5">
              <h3 className="font-semibold text-lg">Fees keep filling the treasury</h3>
              <p className="mt-1 text-inksoft">
                Every trade adds fees. Only {pct(SALARY_POOL_SHARE)} per day goes out, so in busy times the treasury keeps
                climbing and the pool climbs with it.
              </p>
              <div className="mt-4 text-ink">
                <TreasuryChart data={STATS.treasuryHistory} height={140} />
              </div>
              <p className="mt-1 text-xs text-inksoft">Treasury balance, sample data.</p>
            </div>
            <div className="sheet p-5">
              <h3 className="font-semibold text-lg">Getting hired gets more expensive</h3>
              <p className="mt-1 text-inksoft">
                The minimum is counted in coins, not dollars: {MIN_HOLD.toLocaleString("en-US")} {TOKEN_TICKER}. When the
                coin grows, joining costs more, so new employees arrive slower than the pool grows. Those already on
                payroll get a bigger slice.
              </p>
              <div className="mt-4 grid gap-2 text-sm">
                {[
                  ["$1M market cap", "$100 to get hired", 18],
                  ["$5M market cap", "$500 to get hired", 50],
                  ["$20M market cap", "$2,000 to get hired", 100],
                ].map(([cap, cost, w]) => (
                  <div key={cap as string}>
                    <div className="flex justify-between">
                      <span className="text-inksoft">{cap}</span>
                      <span className="font-semibold">{cost}</span>
                    </div>
                    <div className="h-2 mt-1 bg-rule/30">
                      <div className="h-full bg-ink" style={{ width: `${w}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <SalaryCalculator />
        </Section>

        <Section id="points" title="Points and bonuses">
          <p>Points decide your slice of each hourly payroll. One shift earns:</p>
          <div className="sheet p-5 sm:p-6">
            <p className="font-condensed text-3xl sm:text-4xl font-black leading-tight">
              Base points × your score × hold bonus × loyalty bonus
            </p>
            <p className="mt-3 text-inksoft">
              Example: Overtime shift (60), scored 80%, hold bonus × 2.0, loyalty × 1.3: 60 × 0.8 × 2.0 × 1.3 = 124.8
              points.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left sheet">
              <thead className="border-b border-rule text-sm text-inksoft">
                <tr>
                  <th className="font-normal p-3">Shift</th>
                  <th className="font-normal p-3">Difficulty</th>
                  <th className="font-normal p-3">Length</th>
                  <th className="font-normal p-3 text-right">Base points</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(DIFFICULTY_INFO) as Difficulty[]).map((d) => (
                  <tr key={d} className="border-b border-rule last:border-0">
                    <td className="p-3 font-semibold">{DIFFICULTY_INFO[d].shift}</td>
                    <td className="p-3">{DIFFICULTY_INFO[d].label}</td>
                    <td className="p-3 whitespace-nowrap">{DIFFICULTY_INFO[d].duration}</td>
                    <td className="p-3 text-right font-semibold">{BASE_POINTS[d]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="sheet p-5">
              <h3 className="font-semibold text-lg">Hold bonus: bigger bag, bigger pay</h3>
              <p className="text-inksoft">Grows slower than your balance and stops at 3×, so whales earn more but can&rsquo;t take everything.</p>
              <div className="mt-3 grid gap-1.5">
                {HOLD_TIERS.map((t) => (
                  <div key={t.min} className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-2 text-[15px]">
                    <span>{t.min >= 1_000_000 ? `${t.min / 1_000_000}M` : `${t.min / 1000}k`}+</span>
                    <span className="h-3 bg-rule/30">
                      <span className="block h-full bg-ink" style={{ width: `${(t.multiplier / 3) * 100}%` }} />
                    </span>
                    <span className="font-semibold text-right">×{t.multiplier.toFixed(1)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-inksoft">Counted from your lowest balance in the last 24 hours.</p>
            </div>
            <div className="sheet p-5">
              <h3 className="font-semibold text-lg">Loyalty bonus: hold longer, earn more</h3>
              <p className="text-inksoft">
                +5% for every day you&rsquo;ve held without dropping below the minimum, up to 1.5× after 10 days. Selling
                below the minimum starts it again.
              </p>
              <div className="mt-4 flex items-end gap-1 h-20" aria-hidden>
                {Array.from({ length: 12 }, (_, i) => (
                  <div key={i} className="flex-1 bg-ink" style={{ height: `${(Math.min(1.5, 1 + i * 0.05) - 0.9) * 150}%` }} />
                ))}
              </div>
              <div className="flex justify-between text-xs text-inksoft mt-1">
                <span>Day 0: ×1.00</span>
                <span>Day 10+: ×1.50</span>
              </div>
            </div>
          </div>
        </Section>

        <Section id="fair" title="Fair play rules">
          <p>
            Salaries are meant to be earned. These rules stop any one person, or any bot farm, from draining the
            treasury.
          </p>
          <ul className="grid gap-px bg-rule border border-rule rounded-2xl overflow-hidden sm:grid-cols-2">
            {[
              [`${PAID_SHIFTS_PER_DAY}`, "paid shifts a day", `Work as much as you want, but after ${PAID_SHIFTS_PER_DAY} shifts in 24 hours each shift earns only ${pct(OVERTIME_RATE)}. Overtime is paid at intern rates.`],
              [pct(WALLET_HOURLY_CAP), "max per wallet per hour", "No wallet can take more than this share of an hourly slice. Anything above it stays in the treasury."],
              [pct(QUALITY_THRESHOLD), "minimum score", "Score below this and the shift pays nothing. Sloppy work and lazy bots don't get paid."],
              ["24h", "lowest balance counts", "Your hold bonus uses your lowest balance of the day. Buying right before a shift and selling after doesn't help."],
              ["0", "loyalty for new wallets", "Moving coins to a new wallet resets loyalty on both. Splitting a bag into many wallets doesn't pay."],
              ["15m", "for guest shifts", "A guest shift only gets paid if an address that holds the coin is added within 15 minutes. Only the first guest shift counts."],
            ].map(([n, label, body]) => (
              <li key={label} className="bg-sheet p-5">
                <p className="font-condensed text-5xl font-black leading-none">{n}</p>
                <p className="font-semibold mt-1">{label}</p>
                <p className="mt-1 text-sm text-inksoft">{body}</p>
              </li>
            ))}
          </ul>
          <p className="text-inksoft">
            On top of that: a captcha before every shift, cooldowns per address and per device, and every game result
            is checked on the server.
          </p>
        </Section>

        <Section id="titles" title="Titles">
          <p>Every completed assignment counts toward your next title. Titles show on your resume and the leaderboard.</p>
          <ol className="grid gap-px bg-rule border border-rule rounded-2xl overflow-hidden">
            {RANKS.map((r) => (
              <li key={r.title} className="bg-sheet px-4 py-3 flex justify-between gap-4">
                <span className="font-semibold">{r.title}</span>
                <span className="text-inksoft whitespace-nowrap">{r.min === 0 ? "Day one" : `${r.min} tasks`}</span>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="safety" title="Safety">
          <ul className="grid gap-3">
            {[
              "You never connect your wallet. You paste a public address, the same thing you'd give someone to send you SOL.",
              "Salaries are plain transfers from the pay wallet to your address. You don't sign or approve anything to receive them.",
              "Locking your address is optional: one free message signature, never a transaction.",
              "Nobody from the team will ever ask for your seed phrase or private key. Anyone who does is a scammer.",
              "The site never asks you to approve token spending or sign anything you don't recognize.",
            ].map((t) => (
              <li key={t} className="border-l-4 border-ok pl-3">
                {t}
              </li>
            ))}
          </ul>
        </Section>

        <Section id="faq" title="Questions">
          <div className="border-t border-rule">
            {FAQ.map((f) => (
              <details key={f.q} className="group border-b border-rule">
                <summary className="flex justify-between items-center gap-4 py-4 cursor-pointer font-semibold list-none">
                  {f.q}
                  <span className="text-2xl leading-none transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="pb-4 text-inksoft">{f.a}</p>
              </details>
            ))}
          </div>
        </Section>

        <div className="mt-14 glow p-6 sm:p-8">
          <h2 className="font-condensed text-5xl font-black">Ready for your first shift?</h2>
          <Link href="/office/" className="btn btn-marker mt-5">
            Start working
          </Link>
        </div>
      </article>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-16 scroll-mt-6">
      <h2 className="font-condensed text-5xl font-black border-b border-rule pb-2">{title}</h2>
      <div className="mt-5 grid gap-5 text-[17px] leading-relaxed">{children}</div>
    </section>
  );
}

// Same 100 employees, three treasury sizes: the pool and each salary scale with it.
function GrowthBars() {
  const rows = [20, 50, 100];
  const workers = 100;
  const max = rows[rows.length - 1];
  return (
    <div className="sheet p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold text-lg">Same 100 employees, bigger treasury</h3>
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-[#3A4033]" />Treasury</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-marker" />Salary pool</span>
        </div>
      </div>
      <div className="mt-5 grid gap-5">
        {rows.map((t) => {
          const pool = salaryPool(t);
          return (
            <div key={t} className="grid grid-cols-[4.5rem_1fr] sm:grid-cols-[5.5rem_1fr_9rem] gap-x-3 gap-y-1 items-center">
              <span className="font-condensed text-3xl font-black">{t} SOL</span>
              <div className="grid gap-1">
                <div className="h-4 rounded-md bg-[#3A4033]" style={{ width: `${(t / max) * 100}%` }} />
                <div className="h-4 rounded-md bg-marker" style={{ width: `${(pool / max) * 100}%` }} />
              </div>
              <p className="col-start-2 sm:col-start-auto text-sm sm:text-right">
                <span className="font-semibold">{(pool / workers).toFixed(3)} SOL</span>
                <span className="text-inksoft"> per person a day</span>
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-inksoft">
        Average salary if 100 employees share the daily pool equally. Your real share depends on your points.
      </p>
    </div>
  );
}

function SalaryCalculator() {
  const [treasury, setTreasury] = useState(50);
  const [workers, setWorkers] = useState(60);
  const [points, setPoints] = useState(60);
  const avgPoints = 40; // typical points per shift
  const slice = hourlyPayroll(treasury);
  const everyone = workers * avgPoints + points;
  const raw = slice * (points / everyone);
  const cap = slice * WALLET_HOURLY_CAP;
  const pay = Math.min(raw, cap);
  const capped = raw > cap;

  return (
    <div className="glow p-5 sm:p-6">
      <h3 className="font-semibold text-lg">Try it: what does one shift pay?</h3>
      <div className="mt-4 grid gap-6 md:grid-cols-[1fr_15rem] md:items-end">
        <div className="grid gap-4">
          <Slider id="calc-treasury" label="Treasury" value={treasury} min={5} max={300} step={5} suffix=" SOL" onChange={setTreasury} />
          <Slider id="calc-workers" label="Employees working this hour" value={workers} min={1} max={500} step={1} onChange={setWorkers} />
          <Slider id="calc-points" label="Your points for the shift" value={points} min={10} max={270} step={5} onChange={setPoints} />
        </div>
        <div className="md:pl-6 md:border-l border-rule grid gap-2">
          <Row k="Salary pool" v={`${salaryPool(treasury).toFixed(2)} SOL`} />
          <Row k="This hour's payroll" v={`${slice.toFixed(3)} SOL`} />
          <div className="border-t border-rule pt-2">
            <p className="text-ink/60 text-sm">Your pay for this shift</p>
            <p className="font-condensed text-5xl font-black text-marker leading-none mt-1 tabular-nums" translate="no">
              {pay.toFixed(4)}
            </p>
            <p className="text-ink/60 text-sm">
              SOL{capped ? `, capped at ${pct(WALLET_HOURLY_CAP)} of the hour` : ""}
            </p>
            <p className="mt-2 text-sm text-ink/60">
              ≈ {(pay * PAID_SHIFTS_PER_DAY).toFixed(3)} SOL for {PAID_SHIFTS_PER_DAY} paid shifts a day
            </p>
          </div>
        </div>
      </div>
      <p className="mt-4 text-xs text-ink/50">Assumes other employees earn about {avgPoints} points per shift.</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-ink/60">{k}</span>
      <span className="font-semibold tabular-nums" translate="no">{v}</span>
    </div>
  );
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  suffix = "",
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <label htmlFor={id} className="text-ink/60">
          {label}
        </label>
        <span className="font-semibold tabular-nums" translate="no">
          {value.toLocaleString("en-US")}
          {suffix}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full mt-1 accent-[#F1E05A]"
      />
    </div>
  );
}
