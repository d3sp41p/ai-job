"use client";

import { useEffect, useRef, useState } from "react";

// Shared helpers for the job mini-games.

export const rand = (n: number) => Math.floor(Math.random() * n);
export const pickOne = <T,>(a: T[]) => a[rand(a.length)];
export function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// 1.0 if done within `fast` ms, falling linearly to `floor` at `limit` ms
export function timeFactor(ms: number, fast: number, limit: number, floor = 0.6) {
  if (ms <= fast) return 1;
  return Math.max(floor, 1 - ((ms - fast) / (limit - fast)) * (1 - floor));
}

// Countdown that calls onTimeout once. Returns ms left.
export function useCountdown(limitMs: number, onTimeout: () => void, running = true) {
  const [left, setLeft] = useState(limitMs);
  const start = useRef(performance.now());
  const fired = useRef(false);
  const cb = useRef(onTimeout);
  cb.current = onTimeout;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      const l = Math.max(0, limitMs - (performance.now() - start.current));
      setLeft(l);
      if (l <= 0 && !fired.current) {
        fired.current = true;
        cb.current();
      }
    }, 100);
    return () => clearInterval(t);
  }, [limitMs, running]);
  return left;
}

export function useElapsed() {
  const start = useRef(performance.now());
  return () => performance.now() - start.current;
}

export function Hud({ left, right, timeLeft, limit }: { left: React.ReactNode; right?: React.ReactNode; timeLeft?: number; limit?: number }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm text-inksoft">
        <span>{left}</span>
        <span translate="no">{right ?? (timeLeft !== undefined ? `${Math.ceil(timeLeft / 1000)}s` : "")}</span>
      </div>
      {timeLeft !== undefined && limit && (
        <div className="mt-1.5 h-1.5 rounded-full bg-raise overflow-hidden">
          <div
            className={`h-full rounded-full ${timeLeft / limit < 0.25 ? "bg-stamp" : "bg-marker"}`}
            style={{ width: `${(timeLeft / limit) * 100}%`, transition: "width 100ms linear" }}
          />
        </div>
      )}
    </div>
  );
}

// Pointer-based drag for touch and mouse. Returns handlers for the draggable element.
export function useDrag(onMove: (x: number, y: number) => void, onEnd: (x: number, y: number) => void) {
  const active = useRef(false);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      active.current = true;
      (e.target as Element).setPointerCapture?.(e.pointerId);
      onMove(e.clientX, e.clientY);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (active.current) onMove(e.clientX, e.clientY);
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (!active.current) return;
      active.current = false;
      onEnd(e.clientX, e.clientY);
    },
    onPointerCancel: () => {
      active.current = false;
    },
  };
}
