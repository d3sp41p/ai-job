"use client";

// Employee state in the browser. No wallet connection: the employee pastes a Solana address,
// the server reads the balance on-chain and pays salaries to that address automatically.
// Cooldown, shifts, history and the guest shift all come from the server (/api/session).

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { MIN_CLAIM_SOL, PENDING_MINUTES, type Difficulty } from "./config";
import { fakeAddress } from "./mock";
import { signAndLock, type LockResult, type Redeemed } from "./lockClient";

export { PENDING_MINUTES };

export type AddressResult = { ok: true } | { ok: false; error: string; code?: string };

export type HistoryEntry = {
  id: string;
  at: number;
  game: string;
  difficulty: Difficulty;
  performance: number;
  points: number;
  status: "finished" | "abandoned";
};

export type Pending = { at: number; expiresAt: number; game: string };

type Work = {
  cooldownEndsAt: number | null;
  pending: Pending | null; // guest shift waiting for an address
  shiftsToday: number;
  pointsThisHour: number;
  history: HistoryEntry[];
};

type EmployeeState = Work & {
  name: string; // what the AI calls you, optional
  address: string; // "" = guest
  locked: boolean;
  balance: number;
  daysHeld: number;
  tasksCompleted: number;
  unpaidSol: number; // paid automatically at the top of the hour once >= MIN_CLAIM_SOL
  paidSol: number;
  lastPayout: { amount: number; tx: string; at: number } | null;
  redeemed: (NonNullable<Redeemed> & { id: number }) | null; // guest shift credited on address entry
  managerLine: { text: string; id: number };
};

type Ctx = EmployeeState & {
  isGuest: boolean;
  setAddress: (a: string, name?: string) => Promise<AddressResult>;
  setName: (n: string) => Promise<AddressResult>;
  forgetAddress: () => void;
  lockAddress: (address?: string) => Promise<LockResult>;
  ready: boolean; // server session loaded
  refresh: () => Promise<void>; // reload the work file (after a shift)
  setCooldown: (endsAt: number | null) => void;
  payoutNow: () => { amount: number; tx: string } | null;
  say: (text: string) => void;
};

const noWork: Work = { cooldownEndsAt: null, pending: null, shiftsToday: 0, pointsThisHour: 0, history: [] };

const initial: EmployeeState = {
  ...noWork,
  name: "",
  address: "",
  locked: false,
  balance: 0,
  daysHeld: 0,
  tasksCompleted: 0,
  unpaidSol: 0,
  paidSol: 0,
  lastPayout: null,
  redeemed: null,
  managerLine: { text: "", id: 0 },
};

// Live numbers for an address: balance and streak from the chain, work record from our DB
async function fetchWallet(address: string): Promise<Partial<EmployeeState>> {
  try {
    const res = await fetch(`/api/wallet/${address}`, { cache: "no-store" });
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

async function fetchSession() {
  const res = await fetch("/api/session", { cache: "no-store" });
  if (!res.ok) throw new Error("session");
  return res.json();
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

  // the whole file from the server: session, work record, and live wallet numbers
  const refresh = useCallback(async () => {
    try {
      const sess = await fetchSession();
      const live = sess.address ? await fetchWallet(sess.address) : {};
      setS((p) => ({
        ...p,
        ...(sess.work ?? noWork),
        ...live,
        address: sess.address ?? "",
        name: sess.address ? (sess.name ?? "") : p.name,
        locked: !!sess.lockedHere,
      }));
    } catch {
      /* keep what we have */
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setReady(true));
  }, [refresh]);

  const afterAddress = async (redeemed: Redeemed) => {
    await refresh();
    setS((p) => ({ ...p, redeemed: redeemed ? { ...redeemed, id: Date.now() } : null }));
  };

  const value: Ctx = {
    ...s,
    ready,
    isGuest: !s.address,
    refresh,
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
      await afterAddress(data.redeemed ?? null);
      return { ok: true };
    },
    forgetAddress: () => {
      postJson("/api/session/address", undefined, "DELETE").then(() => refresh());
      setS((p) => ({ ...initial, cooldownEndsAt: p.cooldownEndsAt, managerLine: p.managerLine }));
    },
    lockAddress: async (address) => {
      const target = address || s.address;
      const r = await signAndLock(target);
      if (r.ok) await afterAddress(r.redeemed);
      return r;
    },
    setCooldown: (endsAt) => setS((p) => ({ ...p, cooldownEndsAt: endsAt })),
    // PREVIEW until step 8: real payouts are sent by the hourly job
    payoutNow: () => {
      if (s.unpaidSol < MIN_CLAIM_SOL) return null;
      const amount = s.unpaidSol;
      const tx = fakeAddress(Date.now() % 997) + fakeAddress(Date.now() % 991).slice(0, 44);
      setS((p) => ({ ...p, paidSol: p.paidSol + p.unpaidSol, unpaidSol: 0, lastPayout: { amount, tx, at: Date.now() } }));
      return { amount, tx };
    },
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
