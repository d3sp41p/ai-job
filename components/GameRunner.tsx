"use client";

import { useState } from "react";
import {
  COOLDOWN_MINUTES,
  HAS_COOLDOWN,
  DIFFICULTY_INFO,
  MIN_HOLD,
  OVERTIME_RATE,
  PAID_SHIFTS_PER_DAY,
  QUALITY_THRESHOLD,
  WALLET_HOURLY_CAP,
  computePoints,
  hourlyPay,
  hourlyPayroll,
  type Difficulty,
} from "@/lib/config";
import { GAMES } from "@/lib/games";
import { PENDING_MINUTES, isSolanaAddress, useEmployee } from "@/lib/wallet";
import { LINES, pick } from "@/lib/manager";
import { useStats } from "@/lib/stats";
import Turnstile from "./Turnstile";
import type { GameProps } from "./games/types";
import TakeOutTrash from "./games/TakeOutTrash";
import SwipeBadge from "./games/SwipeBadge";
import RefillCoffee from "./games/RefillCoffee";
import SortMail from "./games/SortMail";
import UnjamPrinter from "./games/UnjamPrinter";
import FixWiring from "./games/FixWiring";
import CalibrateArm from "./games/CalibrateArm";
import PackOrders from "./games/PackOrders";
import SupportCalls from "./games/SupportCalls";
import AssemblyLine from "./games/AssemblyLine";
import CircuitBoard from "./games/CircuitBoard";
import DataEntry from "./games/DataEntry";
import NightSecurity from "./games/NightSecurity";
import Forklift from "./games/Forklift";
import BalanceBooks from "./games/BalanceBooks";

const COMPONENTS: Record<string, React.ComponentType<GameProps>> = {
  "take-out-trash": TakeOutTrash,
  "swipe-badge": SwipeBadge,
  "refill-coffee": RefillCoffee,
  "sort-mail": SortMail,
  "unjam-printer": UnjamPrinter,
  "fix-wiring": FixWiring,
  "calibrate-arm": CalibrateArm,
  "pack-orders": PackOrders,
  "support-calls": SupportCalls,
  "assembly-line": AssemblyLine,
  "circuit-board": CircuitBoard,
  "data-entry": DataEntry,
  "night-security": NightSecurity,
  forklift: Forklift,
  "balance-books": BalanceBooks,
};

type Mode = "paid" | "practice" | "guest" | "drill"; // drill = local practice of a chosen job, nothing is saved

type Shift = { id: string | null; gameId: string; mode: Mode; overtime: boolean };

type Result = {
  performance: number;
  summary: string;
  points: ReturnType<typeof computePoints>;
  mode: Mode;
  guest: "pending" | "practice" | null;
};

export default function GameRunner({
  difficulty,
  gameId,
  onClose,
}: {
  difficulty: Difficulty;
  gameId?: string; // set = unpaid practice of this job
  onClose: () => void;
}) {
  const emp = useEmployee();
  const STATS = useStats();
  const [shift, setShift] = useState<Shift | null>(() => (gameId ? { id: null, gameId, mode: "drill", overtime: false } : null));
  const [phase, setPhase] = useState<"intro" | "brief" | "play" | "sending" | "result">(gameId ? "brief" : "intro");
  const [captcha, setCaptcha] = useState<string | null>(null); // null = not solved yet
  const [captchaKey, setCaptchaKey] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [lastRun, setLastRun] = useState<{ performance: number; summary: string } | null>(null);
  const [ticket] = useState(() => 1000 + Math.floor(Math.random() * 9000));
  const [addr, setAddr] = useState("");
  const [nick, setNick] = useState("");
  const [addrErr, setAddrErr] = useState("");

  const game = shift ? GAMES.find((g) => g.id === shift.gameId) : null;
  const d = game?.difficulty ?? difficulty;
  const Game = game ? COMPONENTS[game.id] : null;
  const pendingAlive = !!emp.pending && emp.pending.expiresAt > Date.now();

  // 1) captcha, then the server picks the job. The cooldown starts here.
  const getAssignment = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/shift/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty, captcha }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.cooldownEndsAt) emp.setCooldown(Date.parse(data.cooldownEndsAt));
        setError(data.error || "HR is down. Try again.");
        setCaptcha(null);
        setCaptchaKey((k) => k + 1); // a captcha token works once
        return;
      }
      emp.setCooldown(Date.parse(data.cooldownEndsAt));
      setShift({ id: data.id, gameId: data.gameId, mode: data.mode, overtime: !!data.overtime });
      setPhase("brief");
    } catch {
      setError("No connection to HR. Check your internet and try again.");
    } finally {
      setBusy(false);
    }
  };

  const start = () => {
    emp.say(pick(LINES.shiftStart));
    setPhase("play");
  };

  // 2) the game is over: the server records the result and counts the points
  const send = async (performance: number, summary: string) => {
    if (!shift) return;
    setLastRun({ performance, summary });
    if (shift.mode === "drill") {
      const points = computePoints(d, performance, MIN_HOLD, 0, 0);
      setResult({ performance, summary, points: { ...points, total: 0 }, mode: "drill", guest: null });
      setPhase("result");
      emp.say(pick(!points.passed ? LINES.bad : performance >= 0.75 ? LINES.great : LINES.okay));
      return;
    }
    setPhase("sending");
    setError("");
    try {
      const res = await fetch("/api/shift/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: shift.id, performance, summary }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "HR lost your report.");
        if (data.code === "closed") setPhase("result");
        return;
      }
      setResult(data);
      setPhase("result");
      emp.refresh();
      const passed = data.points?.passed;
      emp.say(
        !passed
          ? pick(LINES.bad)
          : data.guest === "pending"
            ? "Not bad for a stranger. Tell me where to send the money."
            : data.guest === "practice"
              ? "Practice noted. Your first shift is still waiting for an address."
              : pick(performance >= 0.75 ? LINES.great : LINES.okay)
      );
    } catch {
      setError("No connection to HR. Your result is safe here, try sending it again.");
    }
  };

  const addAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSolanaAddress(addr)) {
      setAddrErr("That doesn't look like a Solana address. Paste the full address from your wallet app.");
      return;
    }
    const r = await emp.setAddress(addr.trim(), nick);
    if (!r.ok) {
      setAddrErr(r.error);
      return;
    }
    emp.say("There you are, {name}. Your shift has been sent to the payroll.");
    onClose();
  };

  const passed = !!result && result.points.passed;
  const isGuestShift = result?.mode === "guest";
  const overtimeNext = shift?.overtime || (!emp.isGuest && emp.shiftsToday >= PAID_SHIFTS_PER_DAY);
  const pay = result && result.mode === "paid" ? hourlyPay(STATS.treasurySol, result.points.total, STATS.hourPoints + result.points.total) : 0;
  const capped = pay >= hourlyPayroll(STATS.treasurySol) * WALLET_HOURLY_CAP - 1e-9;
  const stamp = !passed
    ? "Rejected"
    : result?.mode === "drill" || result?.mode === "practice" || result?.guest === "practice"
      ? "Practice"
      : result?.guest === "pending"
        ? "Pending"
        : "Approved";

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="sheet w-full max-w-xl" role="dialog" aria-modal="true" aria-label={game?.name ?? DIFFICULTY_INFO[d].shift}>
        <div className="flex items-center justify-between border-b border-rule px-5 py-3">
          <span className="text-sm text-inksoft">
            Assignment #{ticket} · {DIFFICULTY_INFO[d].shift}
            {shift?.mode === "drill" ? " · practice" : emp.isGuest ? " · guest" : ""}
          </span>
          {phase !== "play" && phase !== "sending" && (
            <button onClick={onClose} className="text-sm underline underline-offset-4">
              Close
            </button>
          )}
        </div>

        <div className="p-5 sm:p-7">
          {phase === "intro" && (
            <>
              <p className="text-inksoft">
                {DIFFICULTY_INFO[d].shift} shift · {DIFFICULTY_INFO[d].duration}
              </p>
              <h2 className="font-condensed text-5xl font-black mt-1">Ready to work?</h2>
              <p className="mt-3 text-lg">{DIFFICULTY_INFO[d].blurb} The AI will pick one of five jobs for you.</p>
              <ul className="mt-5 grid gap-1.5 text-sm text-inksoft">
                <li>Score at least {Math.round(QUALITY_THRESHOLD * 100)}% to get paid.</li>
                {HAS_COOLDOWN && <li>Getting an assignment starts your {COOLDOWN_MINUTES}-minute break, even if you fail or close the window.</li>}
                {emp.isGuest && (
                  <li className="text-marker">
                    {pendingAlive
                      ? "You already have a shift waiting for an address. This one is practice."
                      : `You're a guest. Add your address within ${PENDING_MINUTES} minutes after the shift to get paid for it.`}
                  </li>
                )}
                {overtimeNext && (
                  <li className="text-stamp">
                    You&rsquo;ve worked {PAID_SHIFTS_PER_DAY} shifts today. This one is overtime and pays {Math.round(OVERTIME_RATE * 100)}%.
                  </li>
                )}
              </ul>
              <div className="mt-5">
                <Turnstile key={captchaKey} onToken={(t) => setCaptcha(t)} onError={() => setError("The captcha failed to load. Refresh the page.")} />
              </div>
              {error && <p className="mt-3 text-sm text-stamp">{error}</p>}
              <button className="btn btn-marker mt-4 w-full text-lg" onClick={getAssignment} disabled={busy || captcha === null}>
                {busy ? "Asking the AI…" : captcha === null ? "Prove you're human first" : "Get my assignment"}
              </button>
            </>
          )}

          {phase === "brief" && game && (
            <>
              <p className="text-inksoft">Your manager has assigned you</p>
              <h2 className="font-condensed text-5xl font-black mt-1">{game.name}</h2>
              <blockquote className="mt-5 border-l-4 border-marker pl-4 text-lg">{game.brief}</blockquote>
              <p className="mt-5 text-sm text-inksoft">
                {shift?.mode === "drill"
                  ? "Practice run. Nothing is saved and it doesn't use your break."
                  : shift?.mode === "practice"
                    ? `You need ${MIN_HOLD.toLocaleString("en-US")} coins on your address to get paid. This shift is practice.`
                    : `Score at least ${Math.round(QUALITY_THRESHOLD * 100)}% to get paid.`}
              </p>
              <button className="btn btn-marker mt-6 w-full text-lg" onClick={start}>
                Start shift
              </button>
            </>
          )}

          {phase === "play" && Game && <Game onFinish={send} />}

          {phase === "sending" && (
            <div className="py-6 text-center">
              <p className="font-condensed text-3xl font-black">{error ? "Report not delivered" : "Filing your report…"}</p>
              {error && (
                <>
                  <p className="mt-2 text-stamp">{error}</p>
                  <button className="btn btn-marker mt-4" onClick={() => lastRun && send(lastRun.performance, lastRun.summary)}>
                    Send again
                  </button>
                </>
              )}
            </div>
          )}

          {phase === "result" && !result && (
            <div className="py-6 text-center">
              <p className="font-condensed text-3xl font-black">Shift closed</p>
              <p className="mt-2 text-inksoft">{error || "This shift was already handed in."}</p>
              <button className="btn btn-primary mt-5 w-full" onClick={onClose}>
                Back to the office
              </button>
            </div>
          )}

          {phase === "result" && result && (
            <div className="relative">
              <p className="text-inksoft pr-28">{result.summary}</p>
              <h2 className="font-condensed text-4xl sm:text-5xl font-black mt-1 pr-24 sm:pr-0">
                {passed && result.points.total > 0 ? `+${result.points.total} points` : "No points"}
              </h2>
              <div className="absolute right-0 top-0 text-lg sm:text-2xl stamp stamp-animate" style={{ animationDelay: "100ms" }}>
                {stamp}
              </div>

              <dl className="mt-6 grid grid-cols-[1fr_auto] gap-y-2 border-t border-rule pt-4 text-[15px]">
                <dt className="text-inksoft">Base pay ({DIFFICULTY_INFO[d].label})</dt>
                <dd>{result.points.base}</dd>
                <dt className="text-inksoft">Performance</dt>
                <dd className={passed ? "" : "text-stamp"}>
                  {Math.round(result.performance * 100)}%{!passed && ` (below ${Math.round(QUALITY_THRESHOLD * 100)}%)`}
                </dd>
                {result.mode === "paid" ? (
                  <>
                    <dt className="text-inksoft">Hold bonus</dt>
                    <dd>× {result.points.hold.toFixed(2)}</dd>
                    <dt className="text-inksoft">Loyalty bonus</dt>
                    <dd>× {result.points.streak.toFixed(2)}</dd>
                  </>
                ) : isGuestShift ? (
                  <>
                    <dt className="text-inksoft">Hold and loyalty bonus</dt>
                    <dd className="text-inksoft">after we read your wallet</dd>
                  </>
                ) : null}
                {result.points.overtime && (
                  <>
                    <dt className="text-inksoft">Overtime rate</dt>
                    <dd>× {OVERTIME_RATE.toFixed(2)}</dd>
                  </>
                )}
                <dt className="font-semibold border-t border-rule pt-2">Points this shift</dt>
                <dd className="font-semibold border-t border-rule pt-2">{result.points.total}</dd>
                {passed && result.mode === "paid" && (
                  <>
                    <dt className="text-inksoft">Salary for this shift</dt>
                    <dd className="font-semibold" translate="no">≈ {pay.toFixed(4)} SOL</dd>
                    {capped && (
                      <dd className="col-span-2 text-xs text-inksoft text-right -mt-1">
                        Hit the hourly max of {Math.round(WALLET_HOURLY_CAP * 100)}% per wallet. The rest stays in the treasury.
                      </dd>
                    )}
                  </>
                )}
              </dl>

              {result.guest === "pending" && passed ? (
                <form onSubmit={addAddress} className="mt-5 glow p-4 grid gap-2">
                  <label htmlFor="result-address" className="font-semibold">
                    Paste your Solana address within {PENDING_MINUTES} minutes to get paid
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="result-address"
                      value={addr}
                      onChange={(e) => {
                        setAddr(e.target.value);
                        setAddrErr("");
                      }}
                      placeholder="Your wallet address"
                      className="flex-1 min-w-0 border border-rule rounded-full bg-paper px-4 py-3 font-mono text-sm"
                      spellCheck={false}
                      autoComplete="off"
                    />
                    <button className="btn btn-marker">Get paid</button>
                  </div>
                  {addrErr && <p className="text-sm text-stamp">{addrErr}</p>}
                  <input
                    id="result-name"
                    value={nick}
                    onChange={(e) => setNick(e.target.value)}
                    placeholder="What should the AI call you? (optional)"
                    maxLength={20}
                    className="border border-rule rounded-full bg-paper px-4 py-2.5 text-sm"
                    aria-label="Your name, optional"
                    autoComplete="nickname"
                  />
                  <p className="text-xs text-inksoft">
                    No connection or signature. You need {MIN_HOLD.toLocaleString("en-US")} coins on this address. No coins yet? Buy
                    some and come back within {PENDING_MINUTES} minutes.
                  </p>
                </form>
              ) : (
                <p className="mt-4 text-sm text-inksoft">
                  {result.mode === "drill"
                    ? "Practice run. Nothing was saved."
                    : result.mode === "practice"
                      ? `Practice shifts aren't paid. Hold ${MIN_HOLD.toLocaleString("en-US")} coins to start earning.`
                      : result.guest === "practice"
                        ? "Practice shifts aren't paid. Add your address to start earning."
                        : passed
                          ? "Paid with the hourly payroll, straight to your wallet. The final amount depends on how many points everyone earns this hour."
                          : `The AI has noted this in your file. Score ${Math.round(QUALITY_THRESHOLD * 100)}% or more next time.`}
                </p>
              )}
              <button className="btn btn-primary mt-5 w-full" onClick={onClose}>
                Back to the office
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
