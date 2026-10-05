"use client";

// PREVIEW employee state. No wallet connection: the employee pastes a Solana address,
// the server reads the balance on-chain and pays salaries to that address automatically.
// In production every number here comes from the server (see CLAUDE.md).

import { createContext, useContext, useState, type ReactNode } from "react";
import { COOLDOWN_MINUTES, MIN_CLAIM_SOL, computePoints, type Difficulty } from "./config";
import { fakeAddress, mockResume } from "./mock";

export const PENDING_MINUTES = 15; // guest shift waits this long for an address

export type HistoryEntry = {
  id: number;
  at: number;
  game: string;
  difficulty: Difficulty;
  performance: number;
  points: number;
};

export type Pending = { at: number; game: string; difficulty: Difficulty; performance: number };

type EmployeeState = {
  name: string; // what the AI calls you, optional
  address: string; // "" = guest
  locked: boolean;
  balance: number;
  daysHeld: number;
  tasksCompleted: number;
  pointsThisHour: number;
  shiftsToday: number;
  unpaidSol: number; // paid automatically at the top of the hour once >= MIN_CLAIM_SOL
  paidSol: number;
  lastPayout: { amount: number; tx: string; at: number } | null;
  cooldownEndsAt: number | null;
  pending: Pending | null;
  redeemed: { game: string; points: number; id: number } | null; // guest shift credited on address entry
  history: HistoryEntry[];
  managerLine: { text: string; id: number };
};

type Ctx = EmployeeState & {
  isGuest: boolean;
  setAddress: (a: string, name?: string) => void;
  setName: (n: string) => void;
  forgetAddress: () => void;
  lockAddress: () => void;
  startShift: () => void;
  recordResult: (e: Omit<HistoryEntry, "id" | "at">) => void;
  setPending: (p: Pending | null) => void;
  payoutNow: () => { amount: number; tx: string } | null;
  skipCooldown: () => void;
  say: (text: string) => void;
};

const initial: EmployeeState = {
  name: "",
  address: "",
  locked: false,
  balance: 0,
  daysHeld: 0,
  tasksCompleted: 0,
  pointsThisHour: 0,
  shiftsToday: 0,
  unpaidSol: 0,
  paidSol: 0,
  lastPayout: null,
  cooldownEndsAt: null,
  pending: null,
  redeemed: null,
  history: [],
  managerLine: { text: "", id: 0 },
};

// Sample history shown once an address is added (preview only)
function sampleFor(address: string): Partial<EmployeeState> {
  const r = mockResume(address);
  return {
    balance: Math.max(r.balance, 1_250_000),
    daysHeld: 6,
    tasksCompleted: 29, // preview: one good shift away from a promotion
    shiftsToday: 5,
    unpaidSol: 0.142,
    paidSol: 0.31,
    history: [
      { id: 3, at: Date.now() - 1000 * 60 * 95, game: "Repair the Circuit Board", difficulty: "hard", performance: 0.8, points: 124.8 },
      { id: 2, at: Date.now() - 1000 * 60 * 160, game: "Fix the Wiring", difficulty: "medium", performance: 0.42, points: 0 },
      { id: 1, at: Date.now() - 1000 * 60 * 260, game: "Take Out the Trash", difficulty: "easy", performance: 0.92, points: 23.9 },
    ],
  };
}

const EmployeeContext = createContext<Ctx | null>(null);

export function EmployeeProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<EmployeeState>(initial);

  const value: Ctx = {
    ...s,
    isGuest: !s.address,
    setName: (n) => setS((p) => ({ ...p, name: cleanName(n) })),
    setAddress: (a, name) =>
      setS((p) => {
        const sample = sampleFor(a);
        let next: EmployeeState = {
          ...p,
          ...sample,
          address: a,
          name: name !== undefined && cleanName(name) ? cleanName(name) : p.name,
          locked: false,
          history: [...p.history, ...(sample.history ?? [])],
          pointsThisHour: p.pointsThisHour,
          cooldownEndsAt: p.cooldownEndsAt,
          pending: null,
          redeemed: null,
        };
        // A guest shift finished in the last 15 minutes is credited to this address
        if (p.pending && Date.now() - p.pending.at < PENDING_MINUTES * 60_000) {
          const pts = computePoints(p.pending.difficulty, p.pending.performance, next.balance, next.daysHeld, next.shiftsToday);
          next = {
            ...next,
            tasksCompleted: next.tasksCompleted + (pts.total > 0 ? 1 : 0),
            pointsThisHour: Math.round((next.pointsThisHour + pts.total) * 10) / 10,
            shiftsToday: next.shiftsToday + 1,
            history: [
              { id: Date.now(), at: p.pending.at, game: p.pending.game, difficulty: p.pending.difficulty, performance: p.pending.performance, points: pts.total },
              ...next.history,
            ],
            redeemed: { game: p.pending.game, points: pts.total, id: Date.now() },
          };
        }
        return next;
      }),
    forgetAddress: () => setS((p) => ({ ...initial, cooldownEndsAt: p.cooldownEndsAt, managerLine: p.managerLine })),
    lockAddress: () => setS((p) => ({ ...p, locked: true })),
    startShift: () => setS((p) => ({ ...p, cooldownEndsAt: Date.now() + COOLDOWN_MINUTES * 60_000 })),
    recordResult: (e) =>
      setS((p) => ({
        ...p,
        tasksCompleted: p.tasksCompleted + (e.points > 0 ? 1 : 0),
        pointsThisHour: Math.round((p.pointsThisHour + e.points) * 10) / 10,
        shiftsToday: p.shiftsToday + 1,
        history: [{ ...e, id: Date.now(), at: Date.now() }, ...p.history],
      })),
    setPending: (pending) => setS((p) => ({ ...p, pending })),
    payoutNow: () => {
      if (s.unpaidSol < MIN_CLAIM_SOL) return null;
      const amount = s.unpaidSol;
      const tx = fakeAddress(Date.now() % 997) + fakeAddress(Date.now() % 991).slice(0, 44);
      setS((p) => ({ ...p, paidSol: p.paidSol + p.unpaidSol, unpaidSol: 0, lastPayout: { amount, tx, at: Date.now() } }));
      return { amount, tx };
    },
    skipCooldown: () => setS((p) => ({ ...p, cooldownEndsAt: null })),
    say: (text) => setS((p) => ({ ...p, managerLine: { text, id: p.managerLine.id + 1 } })),
  };

  return <EmployeeContext.Provider value={value}>{children}</EmployeeContext.Provider>;
}

export function useEmployee() {
  const c = useContext(EmployeeContext);
  if (!c) throw new Error("useEmployee must be used inside EmployeeProvider");
  return c;
}

// Names are shown back to the user and on share cards: keep them short and plain
export function cleanName(s: string) {
  return s.replace(/[^\p{L}\p{N} ._-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 20);
}

export const isSolanaAddress = (a: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a.trim());
