"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BASE_POINTS,
  COOLDOWN_MINUTES,
  SHIFT_PACE,
  DIFFICULTY_INFO,
  MIN_CLAIM_SOL,
  MIN_HOLD,
  PAID_SHIFTS_PER_DAY,
  RANKS,
  TOKEN_TICKER,
  BUY_URL,
  hourlyPay,
  hourlyPayroll,
  holdMultiplier,
  rankFor,
  streakMultiplier,
  type Difficulty,
} from "@/lib/config";
import { PENDING_MINUTES, isSolanaAddress, useEmployee } from "@/lib/wallet";
import { shortAddr } from "@/lib/mock";
import { useStats } from "@/lib/stats";
import { LINES, pick } from "@/lib/manager";
import GameRunner from "@/components/GameRunner";
import { GAMES } from "@/lib/games";
import Manager from "@/components/Manager";
import CoffeeBreak from "@/components/CoffeeBreak";
import Payslip from "@/components/Payslip";
import PromotionMemo from "@/components/PromotionMemo";
import { formatDuration, timeAgo, useNow } from "@/components/useNow";

const withArticle = (t: string) => (/^[AEIOU]/.test(t) ? `an ${t}` : `a ${t}`);

export default function OfficePage() {
  const emp = useEmployee();
  const now = useNow();
  const STATS = useStats();
  const [shift, setShift] = useState<Difficulty | null>(null);
  const [forcedGame, setForcedGame] = useState<string | undefined>(undefined);
  const [guestAddr, setGuestAddr] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestErr, setGuestErr] = useState("");
  const [payslip, setPayslip] = useState<{ amount: number; tx: string } | null>(null);
  const [promotion, setPromotion] = useState<{ title: string; previous: string } | null>(null);

  const rank = rankFor(emp.tasksCompleted);
  const lastRank = useRef(rank.index);

  // Show the promotion memo once the game window is closed
  const lastAddress = useRef(emp.address);
  useEffect(() => {
    // A new address loads its own file: that is not a promotion
    if (lastAddress.current !== emp.address) {
      lastAddress.current = emp.address;
      lastRank.current = rank.index;
      return;
    }
    if (shift) return;
    if (rank.index > lastRank.current) {
      setPromotion({ title: rank.title, previous: withArticle(RANKS[rank.index - 1].title) });
      emp.say(pick(LINES.promotion));
    }
    lastRank.current = rank.index;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rank.index, shift, emp.address]);

  const progress = rank.next ? (emp.tasksCompleted - rank.min) / (rank.next.min - rank.min) : 1;
  const onCooldown = emp.cooldownEndsAt !== null && emp.cooldownEndsAt > now;
  const breakLeft = onCooldown ? (emp.cooldownEndsAt! - now) / (Math.max(1, COOLDOWN_MINUTES) * 60_000) : 0;
  const eligible = emp.isGuest || emp.balance >= MIN_HOLD;
  const nextHour = Math.ceil((now + 1) / 3_600_000) * 3_600_000;
  const hourLeft = nextHour - now;
  const slice = hourlyPayroll(STATS.treasurySol);
  const myHourPay = hourlyPay(STATS.treasurySol, emp.pointsThisHour, STATS.hourPoints + emp.pointsThisHour);
  const paidLeft = Math.max(0, PAID_SHIFTS_PER_DAY - emp.shiftsToday);
  const tasksLeft = rank.next ? rank.next.min - emp.tasksCompleted : 0;

  const pendingLeft = emp.pending ? emp.pending.expiresAt - now : 0;
  const pendingAlive = !!emp.pending && pendingLeft > 0;

  const addAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSolanaAddress(guestAddr)) {
      setGuestErr("That doesn't look like a Solana address. Paste the full address from your wallet app.");
      return;
    }
    const r = await emp.setAddress(guestAddr.trim(), guestName);
    if (!r.ok) {
      setGuestErr(r.error);
      return;
    }
    emp.say(pendingAlive ? "There you are, {name}. Your shift has been sent to the payroll." : pick(LINES.greeting));
    setGuestAddr("");
    setGuestName("");
    setGuestErr("");
  };

  // A new salary arrived since the page opened: show the payslip once
  const seenPayout = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const tx = emp.lastPayout?.tx ?? null;
    if (!emp.ready) return;
    if (seenPayout.current === undefined) {
      seenPayout.current = tx;
      return;
    }
    if (tx && tx !== seenPayout.current && emp.lastPayout) {
      seenPayout.current = tx;
      setPayslip(emp.lastPayout);
      emp.say(pick(LINES.claim));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emp.lastPayout?.tx, emp.ready]);

  // the work file (unpaid salary, last payout) refreshes every few minutes while the office is open
  useEffect(() => {
    const t = setInterval(() => emp.refresh(), 3 * 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 grid grid-cols-1 gap-6 lg:grid-cols-[22rem_1fr] items-start">
      {emp.isGuest && (
        <section className={`lg:col-span-2 p-5 sm:p-6 ${pendingAlive ? "glow" : "sheet"}`}>
          <div className="grid gap-5 md:grid-cols-[1fr_minmax(0,26rem)] md:items-center">
            <div>
              {pendingAlive ? (
                <>
                  <p className="text-sm text-marker font-semibold">
                    Pending salary from {emp.pending!.game} · expires in{" "}
                    <span translate="no" className="tabular-nums">{formatDuration(pendingLeft)}</span>
                  </p>
                  <h2 className="font-condensed text-3xl sm:text-4xl font-black mt-1">Paste your address to get paid for that shift.</h2>
                </>
              ) : (
                <>
                  <p className="text-sm text-inksoft">You&rsquo;re working as a guest</p>
                  <h2 className="font-condensed text-3xl sm:text-4xl font-black mt-1">Try a shift now. Add your address to get paid.</h2>
                </>
              )}
              <p className="mt-2 text-inksoft">
                No wallet connection, no signature. We read your {TOKEN_TICKER} balance and send salaries to your address
                automatically.
              </p>
            </div>
            <form onSubmit={addAddress} className="grid gap-2">
              <label htmlFor="guest-address" className="text-sm text-inksoft">Your Solana address</label>
              <div className="flex gap-2">
                <input
                  id="guest-address"
                  value={guestAddr}
                  onChange={(e) => {
                    setGuestAddr(e.target.value);
                    setGuestErr("");
                  }}
                  placeholder="Paste your wallet address"
                  className="flex-1 min-w-0 border border-rule rounded-full bg-paper px-4 py-3 font-mono text-sm"
                  spellCheck={false}
                  autoComplete="off"
                />
                <button className="btn btn-marker">Get paid</button>
              </div>
              {guestErr && <p className="text-sm text-stamp">{guestErr}</p>}
              <input
                id="guest-name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="What should the AI call you? (optional)"
                maxLength={20}
                className="border border-rule rounded-full bg-paper px-4 py-2.5 text-sm"
                aria-label="Your name, optional"
                autoComplete="nickname"
              />
            </form>
          </div>
        </section>
      )}
      {emp.redeemed && !emp.isGuest && (
        <p className="lg:col-span-2 rounded-2xl bg-ok/10 text-ok px-5 py-3 font-semibold">
          {emp.redeemed.points > 0
            ? `Your guest shift (${emp.redeemed.game}) was added: +${emp.redeemed.points} points.`
            : emp.redeemed.reason === "no_coins"
              ? `Your guest shift (${emp.redeemed.game}) wasn't paid: this address holds less than ${MIN_HOLD.toLocaleString("en-US")} coins.`
              : emp.redeemed.reason === "cooldown"
                ? `Your guest shift (${emp.redeemed.game}) wasn't paid: this address already worked a shift in that half hour.`
                : `Your guest shift (${emp.redeemed.game}) earned nothing this time.`}
        </p>
      )}
      {/* Employee badge */}
      <aside className="sheet min-w-0">
        <div className="bg-raise text-ink px-5 py-3 flex justify-between items-baseline">
          <span className="font-semibold">Employee file</span>
          <span className="text-sm text-ink/60 font-mono truncate max-w-[60%]">{emp.isGuest ? "Guest" : emp.name ? `${emp.name} · ${shortAddr(emp.address)}` : shortAddr(emp.address)}</span>
        </div>
        <div className="p-5">
          <p className="text-sm text-inksoft">Current title</p>
          <p className="font-condensed text-4xl font-black leading-none mt-1">{emp.isGuest ? "Visitor" : rank.title}</p>
          {!emp.isGuest && rank.next && (
            <div className="mt-4">
              <div className="h-2 rounded-full bg-raise overflow-hidden">
                <div
                  className="h-full rounded-full bg-marker transition-[width] duration-700"
                  style={{ width: `${Math.min(100, progress * 100)}%` }}
                />
              </div>
              <p className="mt-1.5 text-sm text-inksoft">
                {tasksLeft} {tasksLeft === 1 ? "task" : "tasks"} to {rank.next.title}
              </p>
            </div>
          )}

          <dl className="mt-6 grid grid-cols-2 border-t border-rule">
            {[
              ["Holding", `${(emp.balance / 1_000_000).toFixed(2)}M`],
              ["Days held", String(emp.daysHeld)],
              ["Hold bonus", `× ${holdMultiplier(emp.balance).toFixed(2)}`],
              ["Loyalty bonus", `× ${streakMultiplier(emp.daysHeld).toFixed(2)}`],
              ["Tasks done", String(emp.tasksCompleted)],
              ["Total earned", `${emp.paidSol.toFixed(3)} SOL`],
            ].map(([k, v]) => [k, emp.isGuest ? "—" : v]).map(([k, v], i) => (
              <div key={k} className={`py-3 ${i % 2 ? "pl-4 border-l border-rule" : "pr-4"} border-b border-rule`}>
                <dt className="text-xs text-inksoft">{k}</dt>
                <dd className="text-lg font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          {emp.isGuest ? (
            <p className="mt-4 text-sm text-inksoft">Your file opens when you add your address.</p>
          ) : (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
              <Link href={`/resume/?address=${emp.address}`} className="underline underline-offset-4">
                View my public resume
              </Link>
              <span className={emp.locked ? "text-ok" : "text-inksoft"}>{emp.locked ? "Address locked" : "Address not locked"}</span>
            </div>
          )}
        </div>
      </aside>

      <div className="grid grid-cols-1 gap-6 min-w-0">
        <Manager />

        {/* Assignment */}
        <section className="sheet p-5 sm:p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="font-condensed text-4xl sm:text-5xl font-black">
              {onCooldown ? "Coffee break" : "Your next assignment"}
            </h1>
            <span className="text-sm text-inksoft">Assignments {SHIFT_PACE}</span>
          </div>

          {!eligible ? (
            <div className="mt-4 border-l-4 border-stamp pl-3">
              <p>You need at least {MIN_HOLD.toLocaleString("en-US")} {TOKEN_TICKER} to take assignments.</p>
              {BUY_URL && (
                <a href={BUY_URL} target="_blank" rel="noreferrer" className="btn btn-marker mt-3">
                  Buy {TOKEN_TICKER} on pump.fun
                </a>
              )}
            </div>
          ) : onCooldown ? (
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
              <CoffeeBreak left={breakLeft} />
              <div>
                <p className="font-condensed text-[clamp(4rem,12vw,6.5rem)] font-black leading-none tabular-nums" translate="no">
                  {formatDuration(emp.cooldownEndsAt! - now)}
                </p>
                <p className="text-inksoft">until the AI needs you again.</p>
              </div>
            </div>
          ) : (
            <div className="mt-6 grid sm:grid-cols-3 gap-3">
              {(Object.keys(DIFFICULTY_INFO) as Difficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setShift(d)}
                  className="btn btn-plain !rounded-2xl !flex-col !items-start !justify-start text-left !p-4 h-full"
                >
                  <span className="flex w-full justify-between items-baseline">
                    <span className="font-condensed text-3xl font-black">{DIFFICULTY_INFO[d].shift}</span>
                    <span className="text-sm font-normal text-inksoft">{DIFFICULTY_INFO[d].label}</span>
                  </span>
                  <span className="text-sm font-normal text-inksoft">{DIFFICULTY_INFO[d].blurb}</span>
                  <span className="text-xs font-normal text-inksoft/80 mt-2">
                    {GAMES.filter((g) => g.difficulty === d).map((g) => g.name).join(" · ")}
                  </span>
                  <span className="mt-auto pt-2">{BASE_POINTS[d]} base points</span>
                </button>
              ))}
            </div>
          )}
          <details className="mt-5 rounded-2xl border border-dashed border-rule p-3">
            <summary className="cursor-pointer text-sm text-inksoft">Practice a specific job (unpaid, no break)</summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {(Object.keys(DIFFICULTY_INFO) as Difficulty[]).map((d) => (
                <div key={d} className="grid gap-1.5">
                  <p className="text-xs text-inksoft">{DIFFICULTY_INFO[d].shift}</p>
                  {GAMES.filter((g) => g.difficulty === d).map((g) => (
                    <button
                      key={g.id}
                      className="text-left text-sm rounded-xl bg-raise px-3 py-2 hover:bg-rule"
                      onClick={() => {
                        setForcedGame(g.id);
                        setShift(d);
                      }}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </details>
        </section>

        {/* Payroll */}
        <section className="sheet grid md:grid-cols-2">
          <div className="p-5 border-b md:border-b-0 md:border-r border-rule">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm text-inksoft">This hour&rsquo;s payroll</p>
              <p className="text-sm text-inksoft">
                Paid in <span translate="no" className="font-semibold text-ink tabular-nums">{now ? formatDuration(hourLeft) : "--:--"}</span>
              </p>
            </div>
            <p className="font-condensed text-5xl font-black mt-1" translate="no">
              {slice.toFixed(slice < 0.001 ? 5 : 3)} SOL
            </p>
            <p className="text-sm text-inksoft">
              Shared by {STATS.workersThisHour} employees working this hour.
            </p>
            <div className="mt-4 border-t border-rule pt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-inksoft">Your points this hour</p>
                <p className="text-lg font-semibold">{emp.pointsThisHour}</p>
              </div>
              <div>
                <p className="text-xs text-inksoft">Your pay this hour</p>
                <p className="text-lg font-semibold" translate="no">≈ {myHourPay.toFixed(4)} SOL</p>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-inksoft">
                <span>Paid shifts today</span>
                <span className={paidLeft === 0 ? "text-stamp font-semibold" : ""}>
                  {Math.min(emp.shiftsToday, PAID_SHIFTS_PER_DAY)}/{PAID_SHIFTS_PER_DAY}
                  {paidLeft === 0 && ", overtime now"}
                </span>
              </div>
              <div className="mt-1 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${PAID_SHIFTS_PER_DAY}, 1fr)` }} aria-hidden>
                {Array.from({ length: PAID_SHIFTS_PER_DAY }, (_, i) => (
                  <span key={i} className={`h-2 rounded-full ${i < emp.shiftsToday ? "bg-marker" : "bg-raise"}`} />
                ))}
              </div>
            </div>
            <Link href="/how-it-works/#salary" className="mt-3 inline-block text-sm underline underline-offset-4">
              How salaries work
            </Link>
          </div>
          <div className="p-5 flex flex-col">
            <p className="text-sm text-inksoft">Unpaid salary</p>
            <p className="font-condensed text-5xl font-black mt-1" translate="no">{emp.unpaidSol.toFixed(3)} SOL</p>
            <p className="text-sm text-inksoft mt-1">
              {emp.isGuest
                ? "Add your address and salary is sent to it automatically every hour."
                : `Sent to ${shortAddr(emp.address)} automatically at the top of the hour once it reaches ${MIN_CLAIM_SOL} SOL. No claiming, no fees for you.`}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-rule pt-3">
              <div>
                <p className="text-xs text-inksoft">Total paid to you</p>
                <p className="text-lg font-semibold" translate="no">{emp.paidSol.toFixed(3)} SOL</p>
              </div>
              <div>
                <p className="text-xs text-inksoft">Last payslip</p>
                {emp.lastPayout ? (
                  <button className="text-lg font-semibold underline underline-offset-4" onClick={() => setPayslip(emp.lastPayout)}>
                    {emp.lastPayout.amount.toFixed(3)} SOL
                  </button>
                ) : (
                  <p className="text-lg font-semibold text-inksoft">None yet</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* History */}
        <section className="sheet">
          <h2 className="px-5 pt-5 font-condensed text-3xl font-black">Work history</h2>
          {emp.history.length === 0 && (
            <p className="px-5 pt-2 pb-5 text-inksoft">No shifts yet. Pick one above and the AI will start your file.</p>
          )}
          <div className="overflow-x-auto">
            <table className="mt-3 w-full text-left text-[15px]">
              <thead className="text-sm text-inksoft border-b border-rule">
                <tr>
                  <th className="font-normal px-5 py-2">When</th>
                  <th className="font-normal px-2 py-2">Assignment</th>
                  <th className="font-normal px-2 py-2">Shift</th>
                  <th className="font-normal px-2 py-2 text-right">Performance</th>
                  <th className="font-normal px-5 py-2 text-right">Points</th>
                </tr>
              </thead>
              <tbody>
                {emp.history.map((h) => (
                  <tr key={h.id} className="border-b border-rule last:border-0">
                    <td className="px-5 py-2.5 whitespace-nowrap text-inksoft">{timeAgo(h.at, now)}</td>
                    <td className="px-2 py-2.5 whitespace-nowrap">{h.game}</td>
                    <td className="px-2 py-2.5 whitespace-nowrap">{DIFFICULTY_INFO[h.difficulty].shift}</td>
                    <td className="px-2 py-2.5 text-right">{h.status === "abandoned" ? "—" : `${Math.round(h.performance * 100)}%`}</td>
                    <td className={`px-5 py-2.5 text-right font-semibold ${h.points === 0 ? "text-stamp" : ""}`}>
                      {h.status === "abandoned" ? "Abandoned" : h.points === 0 ? "No pay" : `+${h.points}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {shift && (
        <GameRunner
          difficulty={shift}
          gameId={forcedGame}
          onClose={() => {
            setShift(null);
            setForcedGame(undefined);
          }}
        />
      )}
      {payslip && (
        <Payslip
          amount={payslip.amount}
          tx={payslip.tx}
          address={emp.address}
          title={rank.title}
          tasks={emp.tasksCompleted}
          days={emp.daysHeld}
          onClose={() => setPayslip(null)}
        />
      )}
      {promotion && (
        <PromotionMemo
          title={promotion.title}
          previous={promotion.previous}
          address={emp.address}
          tasks={emp.tasksCompleted}
          onClose={() => setPromotion(null)}
        />
      )}
    </div>
  );
}
