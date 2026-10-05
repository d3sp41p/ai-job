"use client";

import { useState } from "react";
import {
  computePoints,
  DIFFICULTY_INFO,
  hourlyPay,
  hourlyPayroll,
  MIN_HOLD,
  OVERTIME_RATE,
  PAID_SHIFTS_PER_DAY,
  QUALITY_THRESHOLD,
  WALLET_HOURLY_CAP,
  type Difficulty,
} from "@/lib/config";
import { GAMES, pickGame, type GameDef } from "@/lib/games";
import { PENDING_MINUTES, isSolanaAddress, useEmployee } from "@/lib/wallet";
import { LINES, pick } from "@/lib/manager";
import { STATS } from "@/lib/mock";
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

type Result = {
  performance: number;
  summary: string;
  points: ReturnType<typeof computePoints>;
  guest: "pending" | "practice" | null;
};

export default function GameRunner({
  difficulty,
  gameId,
  onClose,
}: {
  difficulty: Difficulty;
  gameId?: string;
  onClose: () => void;
}) {
  const emp = useEmployee();
  const [game] = useState<GameDef>(() => GAMES.find((g) => g.id === gameId) ?? pickGame(difficulty));
  const [phase, setPhase] = useState<"brief" | "play" | "result">("brief");
  const [result, setResult] = useState<Result | null>(null);
  const [ticket] = useState(() => 1000 + Math.floor(Math.random() * 9000));
  const [addr, setAddr] = useState("");
  const [nick, setNick] = useState("");
  const [addrErr, setAddrErr] = useState("");
  const d = game.difficulty;

  const Game = COMPONENTS[game.id];
  const pendingAlive = !!emp.pending && Date.now() - emp.pending.at < PENDING_MINUTES * 60_000;

  const start = () => {
    emp.startShift(); // cooldown starts when the shift starts
    emp.say(pick(LINES.shiftStart));
    setPhase("play");
  };

  const finish = (performance: number, summary: string) => {
    if (phase === "result") return;
    if (emp.isGuest) {
      // Bonuses are unknown until we read the wallet, so show base pay
      const points = computePoints(d, performance, MIN_HOLD, 0, 0);
      const guest = pendingAlive ? "practice" : "pending";
      if (guest === "pending" && points.passed) emp.setPending({ at: Date.now(), game: game.name, difficulty: d, performance });
      setResult({ performance, summary, points, guest });
      setPhase("result");
      emp.say(
        !points.passed
          ? pick(LINES.bad)
          : guest === "pending"
            ? "Not bad for a stranger. Tell me where to send the money."
            : "Practice noted. Your first shift is still waiting for an address."
      );
      return;
    }
    const points = computePoints(d, performance, emp.balance, emp.daysHeld, emp.shiftsToday);
    emp.recordResult({ game: game.name, difficulty: d, performance, points: points.total });
    setResult({ performance, summary, points, guest: null });
    setPhase("result");
    emp.say(pick(!points.passed ? LINES.bad : performance >= 0.75 ? LINES.great : LINES.okay));
  };

  const addAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSolanaAddress(addr)) {
      setAddrErr("That doesn't look like a Solana address. Paste the full address from your wallet app.");
      return;
    }
    emp.setAddress(addr.trim(), nick);
    emp.say("There you are, {name}. Your shift has been added to the payroll.");
    onClose();
  };

  const passed = !!result && result.points.passed;
  const overtimeNext = !emp.isGuest && emp.shiftsToday >= PAID_SHIFTS_PER_DAY;
  const pay = result ? hourlyPay(STATS.treasurySol, result.points.total, STATS.hourPoints + result.points.total) : 0;
  const capped = pay >= hourlyPayroll(STATS.treasurySol) * WALLET_HOURLY_CAP - 1e-9;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="sheet w-full max-w-xl" role="dialog" aria-modal="true" aria-label={game.name}>
        <div className="flex items-center justify-between border-b border-rule px-5 py-3">
          <span className="text-sm text-inksoft">
            Assignment #{ticket} · {DIFFICULTY_INFO[d].shift}
            {emp.isGuest && " · guest"}
          </span>
          {phase !== "play" && (
            <button onClick={onClose} className="text-sm underline underline-offset-4">
              Close
            </button>
          )}
        </div>

        <div className="p-5 sm:p-7">
          {phase === "brief" && (
            <>
              <p className="text-inksoft">Your manager has assigned you</p>
              <h2 className="font-condensed text-5xl font-black mt-1">{game.name}</h2>
              <blockquote className="mt-5 border-l-4 border-marker pl-4 text-lg">{game.brief}</blockquote>
              <ul className="mt-5 grid gap-1.5 text-sm text-inksoft">
                <li>Score at least {Math.round(QUALITY_THRESHOLD * 100)}% to get paid.</li>
                <li>Starting the shift uses your cooldown, even if you fail or close the window.</li>
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
              <button className="btn btn-marker mt-6 w-full text-lg" onClick={start}>
                Start shift
              </button>
            </>
          )}

          {phase === "play" && Game && <Game onFinish={finish} />}

          {phase === "result" && result && (
            <div className="relative">
              <p className="text-inksoft pr-28">{result.summary}</p>
              <h2 className="font-condensed text-4xl sm:text-5xl font-black mt-1 pr-24 sm:pr-0">{passed ? `+${result.points.total} points` : "No points"}</h2>
              <div className="absolute right-0 top-0 text-lg sm:text-2xl stamp stamp-animate" style={{ animationDelay: "100ms" }}>
                {!passed ? "Rejected" : result.guest === "pending" ? "Pending" : result.guest === "practice" ? "Practice" : "Approved"}
              </div>

              <dl className="mt-6 grid grid-cols-[1fr_auto] gap-y-2 border-t border-rule pt-4 text-[15px]">
                <dt className="text-inksoft">Base pay ({DIFFICULTY_INFO[d].label})</dt>
                <dd>{result.points.base}</dd>
                <dt className="text-inksoft">Performance</dt>
                <dd className={passed ? "" : "text-stamp"}>
                  {Math.round(result.performance * 100)}%{!passed && ` (below ${Math.round(QUALITY_THRESHOLD * 100)}%)`}
                </dd>
                {result.guest ? (
                  <>
                    <dt className="text-inksoft">Hold and loyalty bonus</dt>
                    <dd className="text-inksoft">after we read your wallet</dd>
                  </>
                ) : (
                  <>
                    <dt className="text-inksoft">Hold bonus</dt>
                    <dd>× {result.points.hold.toFixed(2)}</dd>
                    <dt className="text-inksoft">Loyalty bonus</dt>
                    <dd>× {result.points.streak.toFixed(2)}</dd>
                  </>
                )}
                {result.points.overtime && (
                  <>
                    <dt className="text-inksoft">Overtime rate</dt>
                    <dd>× {OVERTIME_RATE.toFixed(2)}</dd>
                  </>
                )}
                <dt className="font-semibold border-t border-rule pt-2">Points this shift</dt>
                <dd className="font-semibold border-t border-rule pt-2">{result.points.total}</dd>
                {passed && (
                  <>
                    <dt className="text-inksoft">Salary for this shift</dt>
                    <dd className="font-semibold" translate="no">≈ {pay.toFixed(4)} SOL</dd>
                    {capped && !result.guest && (
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
                  {result.guest === "practice"
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
