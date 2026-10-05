"use client";

// Live site numbers from /api/stats, shared by every component on the page and refreshed every minute.

import { useEffect, useState } from "react";
import type { SiteStats } from "./server/stats";

export type Stats = SiteStats;

const EMPTY: Stats = {
  live: false,
  treasurySol: 0,
  salaryPoolSol: 0,
  thisHourSol: 0,
  totalPaidSol: 0,
  payouts: 0,
  workers: 0,
  tasksDone: 0,
  feesAllTimeSol: 0,
  hourPoints: 0,
  workersThisHour: 0,
  treasuryHistory: [0, 0],
  leaderboard: [],
  recentPayouts: [],
  treasuryAddress: "",
  payoutAddress: "",
};

let cache: Stats = EMPTY;
let loadedAt = 0;
let inflight: Promise<void> | null = null;
const listeners = new Set<(s: Stats) => void>();

function load() {
  if (inflight || Date.now() - loadedAt < 20_000) return;
  inflight = fetch("/api/stats")
    .then((r) => (r.ok ? r.json() : null))
    .then((s) => {
      if (s && !s.error) {
        cache = s;
        loadedAt = Date.now();
        listeners.forEach((l) => l(cache));
      }
    })
    .catch(() => {})
    .finally(() => {
      inflight = null;
    });
}

export function useStats(): Stats {
  const [s, setS] = useState(cache);
  useEffect(() => {
    listeners.add(setS);
    load();
    const t = setInterval(load, 60_000);
    return () => {
      listeners.delete(setS);
      clearInterval(t);
    };
  }, []);
  return s;
}

/** Latest numbers outside React (canvas drawing). May be empty until the first load. */
export const currentStats = () => cache;
