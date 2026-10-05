"use client";

// PREVIEW employee state. No wallet connection: the employee pastes a Solana address,
// the server reads the balance on-chain and pays salaries to that address automatically.
// In production every number here comes from the server (see CLAUDE.md).

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { COOLDOWN_MINUTES, MIN_CLAIM_SOL, computePoints, type Difficulty } from "./config";
import { fakeAddress } from "./mock";
import { signAndLock, type LockResult } from "./lockClient";

export type AddressResult = { ok: true } | { ok: false; error: string; code?: string };

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
  setAddress: (a: string, name?: string) => Promise<AddressResult>;
  setName: (n: string) => Promise<AddressResult>;
  forgetAddress: () => void;
  lockAddress: (address?: string) => Promise<LockResult>;
  ready: boolean; // server session loaded
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

// Live numbers for an address: balance and streak from the chain, work record from our DB
async function fetchWallet(address: string): Promise<Partial<EmployeeState>> {
  try {
    const res = await fetch(`/api/wallet/${address}`);
    if (!res.ok) return {};
    const w = await res.json();
    return {
      balance: Number(w.balance) || 0,
      daysHeld: Number(w.daysHeld) || 0,
      tasksCompleted: Number(w.tasksCompleted) || 0,
      paidSol: Number(w.earnedSol) || 0,
      unpaidSol: Number(w.unpaidSol) || 0,
    };
  } catch {
    return {};
  }
}

async function postJson(url: string, body?: unknown, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

const EmployeeContext = createContext<Ctx | null>(null);

export function EmployeeProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<EmployeeState>(initial);
  const [ready, setReady] = useState(false);

  const say = useCallback((text: string) => setS((p) => ({ ...p, managerLine: { text, id: p.managerLine.id + 1 } })), []);

  // restore this device's session (address, name, lock) on load
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/session");
        const sess = await res.json();
        if (alive && res.ok && sess.address) {
          const live = await fetchWallet(sess.address);
          if (!alive) return;
          setS((p) => ({ ...p, ...live, address: sess.address, name: sess.name ?? "", locked: !!sess.lockedHere }));
        }
      } catch {
        /* stay a guest */
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const applyAddress = async (a: string, serverName: string | null, lockedHere: boolean) => {
    const live = await fetchWallet(a);
    setS((p) => {
      let next: EmployeeState = {
        ...p,
        ...live,
        address: a,
        name: serverName ?? p.name,
        locked: lockedHere,
        history: a === p.address ? p.history : [],
        pending: null,
        redeemed: null,
      };
      // PREVIEW until step 6: a guest shift from the last 15 minutes is credited locally.
      // Step 6 moves this to the server (guest_shifts table).
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
    });
  };

  const value: Ctx = {
    ...s,
    ready,
    isGuest: !s.address,
    setName: async (n) => {
      const { ok, data } = await postJson("/api/session/name", { name: n });
      if (!ok) {
        say(data.error || "HR lost your paperwork. Try again.");
        return { ok: false, error: data.error || "Try again." };
      }
      setS((p) => ({ ...p, name: data.name ?? "" }));
      return { ok: true };
    },
    setAddress: async (a, name) => {
      const { ok, data } = await postJson("/api/session/address", { address: a.trim(), name: name ? cleanName(name) : "" });
      if (!ok) {
        say(data.error || "HR couldn't process that address.");
        return { ok: false, error: data.error || "Try again.", code: data.code };
      }
      await applyAddress(data.address, data.name, !!data.lockedHere);
      return { ok: true };
    },
    forgetAddress: () => {
      postJson("/api/session/address", undefined, "DELETE");
      setS((p) => ({ ...initial, cooldownEndsAt: p.cooldownEndsAt, managerLine: p.managerLine }));
    },
    lockAddress: async (address) => {
      const target = address || s.address;
      const r = await signAndLock(target);
      if (r.ok) await applyAddress(r.address, null, true);
      return r;
    },
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
    say,
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
