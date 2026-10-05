"use client";

import { useRef, useState } from "react";
import type { GameProps } from "./types";
import { Hud, shuffle, timeFactor, useCountdown, useElapsed } from "./kit";

const LIMIT = 30_000;
type Dir = "up" | "down" | "left" | "right";
// Five jam spots around the printer; each sheet must be pulled away from the printer
const SPOTS: { dir: Dir; style: React.CSSProperties }[] = [
  { dir: "up", style: { left: "30%", top: "6%", width: 54, height: 70 } },
  { dir: "up", style: { left: "58%", top: "6%", width: 54, height: 70 } },
  { dir: "left", style: { left: "4%", top: "42%", width: 74, height: 50 } },
  { dir: "right", style: { right: "4%", top: "38%", width: 74, height: 50 } },
  { dir: "down", style: { left: "44%", bottom: "4%", width: 54, height: 66 } },
];

export default function UnjamPrinter({ onFinish }: GameProps) {
  const [order] = useState(() => shuffle(SPOTS.map((_, i) => i)));
  const [pulled, setPulled] = useState<number[]>([]);
  const [tears, setTears] = useState(0);
  const [msg, setMsg] = useState("Pull each jammed sheet out. Pull the wrong way and it tears.");
  const [printed, setPrinted] = useState(false);
  const start = useRef<{ i: number; x: number; y: number } | null>(null);
  const elapsed = useElapsed();
  const done = useRef(false);

  const finish = (timedOut = false) => {
    if (done.current) return;
    done.current = true;
    const share = pulled.length / SPOTS.length;
    const perf = share * (timedOut ? 0.6 : timeFactor(elapsed(), 10_000, LIMIT)) * Math.max(0.3, 1 - 0.15 * tears);
    onFinish(perf, `${pulled.length} of ${SPOTS.length} sheets out, ${tears} torn`);
  };
  const timeLeft = useCountdown(LIMIT, () => finish(true));

  const release = (i: number, x: number, y: number) => {
    const s = start.current;
    start.current = null;
    if (!s || s.i !== i) return;
    const dx = x - s.x;
    const dy = y - s.y;
    if (Math.hypot(dx, dy) < 30) {
      setMsg("Pull it, don't poke it.");
      return;
    }
    const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    if (dir === SPOTS[i].dir) {
      setPulled((p) => [...p, i]);
      setMsg("Out.");
    } else {
      setTears((t) => t + 1);
      setMsg("Riiip. That sheet tore. Pull it the other way.");
    }
  };

  const allOut = pulled.length === SPOTS.length;

  return (
    <div>
      <Hud left={`${pulled.length}/${SPOTS.length} sheets · ${tears} torn`} timeLeft={timeLeft} limit={LIMIT} />
      <div className="relative h-72 rounded-2xl bg-raise border border-rule overflow-hidden select-none touch-none">
        {/* printer */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-28 rounded-2xl bg-paper border border-rule flex items-center justify-center">
          <span className={`h-3 w-3 rounded-full absolute right-3 top-3 ${allOut ? "bg-ok" : "bg-stamp animate-pulse"}`} />
          <span className="text-sm text-inksoft">{printed ? "Printing…" : allOut ? "Ready" : "PAPER JAM"}</span>
        </div>
        {order.map((i) =>
          pulled.includes(i) ? null : (
            <div
              key={i}
              className="absolute rounded-md bg-[#E9E5D6] shadow-md cursor-grab"
              style={{ ...SPOTS[i].style, transform: `rotate(${(i % 2 ? 1 : -1) * 4}deg)` }}
              onPointerDown={(e) => {
                (e.target as Element).setPointerCapture(e.pointerId);
                start.current = { i, x: e.clientX, y: e.clientY };
              }}
              onPointerUp={(e) => release(i, e.clientX, e.clientY)}
              aria-label="Jammed sheet"
            >
              <div className="m-2 space-y-1">
                <div className="h-1 bg-paper/30 rounded" />
                <div className="h-1 bg-paper/30 rounded w-2/3" />
                <div className="h-1 bg-paper/30 rounded" />
              </div>
            </div>
          )
        )}
      </div>
      <p className="mt-3 text-[15px] text-inksoft min-h-[1.5em]">{msg}</p>
      <button
        className="btn btn-marker w-full mt-2"
        disabled={!allOut || printed}
        onClick={() => {
          setPrinted(true);
          setTimeout(() => finish(), 600);
        }}
      >
        {allOut ? "Print a test page" : "Clear the jam first"}
      </button>
    </div>
  );
}
