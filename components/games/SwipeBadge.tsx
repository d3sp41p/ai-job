"use client";

import { useRef, useState } from "react";
import type { GameProps } from "./types";
import { Hud, useCountdown } from "./kit";

const LIMIT = 30_000;
const MAX_TRIES = 6;
const MIN_MS = 350;
const MAX_MS = 1100;

export default function SwipeBadge({ onFinish }: GameProps) {
  const track = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0); // 0..1 position of the card
  const [tries, setTries] = useState(0);
  const [status, setStatus] = useState<"idle" | "ok" | "bad">("idle");
  const [msg, setMsg] = useState("Swipe your badge through the reader. Not too fast, not too slow.");
  const t0 = useRef(0);
  const startX = useRef(0);
  const dragging = useRef(false);
  const done = useRef(false);

  const finish = (success: boolean, n: number) => {
    if (done.current) return;
    done.current = true;
    const perf = success ? Math.max(0.5, 1 - 0.12 * (n - 1)) : 0;
    onFinish(perf, success ? `Badge accepted on try ${n}` : "The reader never accepted your badge");
  };
  const timeLeft = useCountdown(LIMIT, () => finish(false, tries));

  const width = () => track.current!.getBoundingClientRect().width - 96;

  const release = () => {
    if (!dragging.current) return;
    dragging.current = false;
    const dt = performance.now() - t0.current;
    const n = tries + 1;
    setTries(n);
    if (x < 0.92) {
      setStatus("bad");
      setMsg("Swipe all the way through.");
    } else if (dt < MIN_MS) {
      setStatus("bad");
      setMsg("Too fast. The reader is old. Like your career.");
    } else if (dt > MAX_MS) {
      setStatus("bad");
      setMsg("Too slow. Are you even awake?");
    } else {
      setStatus("ok");
      setMsg("Accepted. Welcome to work.");
      setTimeout(() => finish(true, n), 700);
      return;
    }
    setTimeout(() => setX(0), 250);
    if (n >= MAX_TRIES) setTimeout(() => finish(false, n), 800);
  };

  return (
    <div>
      <Hud left={`Try ${Math.min(tries + 1, MAX_TRIES)} of ${MAX_TRIES}`} timeLeft={timeLeft} limit={LIMIT} />
      <div className="rounded-2xl bg-raise border border-rule p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-inksoft">Badge reader</span>
          <span className={`h-3 w-3 rounded-full ${status === "ok" ? "bg-ok" : status === "bad" ? "bg-stamp" : "bg-rule"}`} />
        </div>
        <div ref={track} className="relative mt-4 h-28 rounded-xl bg-paper border border-rule overflow-hidden touch-none select-none">
          <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 bg-black/60" aria-hidden />
          <div
            className={`absolute top-1/2 -translate-y-1/2 left-2 w-24 h-16 rounded-lg bg-gradient-to-br from-marker to-[#c9b93f] text-paper p-2 cursor-grab shadow-lg ${
              dragging.current ? "" : "transition-transform duration-200"
            }`}
            style={{ transform: `translate(${x * (track.current ? width() : 0)}px, -50%)` }}
            onPointerDown={(e) => {
              if (done.current) return;
              (e.target as Element).setPointerCapture(e.pointerId);
              dragging.current = true;
              t0.current = performance.now();
              startX.current = e.clientX - x * width();
              setStatus("idle");
            }}
            onPointerMove={(e) => {
              if (!dragging.current) return;
              setX(Math.max(0, Math.min(1, (e.clientX - startX.current) / width())));
            }}
            onPointerUp={release}
            onPointerCancel={release}
          >
            <p className="text-[10px] font-bold leading-none">EMPLOYEE</p>
            <p className="text-[9px] mt-1 leading-tight">AI Gave Me a Job</p>
            <div className="mt-1 h-1.5 w-10 bg-paper/60 rounded" />
          </div>
        </div>
        <p className={`mt-4 text-[15px] ${status === "bad" ? "text-stamp" : status === "ok" ? "text-ok" : "text-inksoft"}`}>{msg}</p>
      </div>
    </div>
  );
}
