"use client";

import { useEffect, useRef, useState } from "react";
import type { GameProps } from "./types";
import { Hud, shuffle, timeFactor, useCountdown, useElapsed } from "./kit";

const LIMIT = 90_000;
const N = 8;
// walls[i] bits: N=1, E=2, S=4, W=8 (1 = wall present)
type Dir = "up" | "down" | "left" | "right";
const MOVES: Record<Dir, { dr: number; dc: number; bit: number; opp: number }> = {
  up: { dr: -1, dc: 0, bit: 1, opp: 4 },
  right: { dr: 0, dc: 1, bit: 2, opp: 8 },
  down: { dr: 1, dc: 0, bit: 4, opp: 1 },
  left: { dr: 0, dc: -1, bit: 8, opp: 2 },
};

function makeMaze() {
  const walls = Array(N * N).fill(15);
  const seen = Array(N * N).fill(false);
  const stack = [0];
  seen[0] = true;
  while (stack.length) {
    const i = stack[stack.length - 1];
    const r = Math.floor(i / N);
    const c = i % N;
    const opts = shuffle(Object.values(MOVES)).filter((m) => {
      const rr = r + m.dr;
      const cc = c + m.dc;
      return rr >= 0 && rr < N && cc >= 0 && cc < N && !seen[rr * N + cc];
    });
    if (!opts.length) {
      stack.pop();
      continue;
    }
    const m = opts[0];
    const j = (r + m.dr) * N + (c + m.dc);
    walls[i] &= ~m.bit;
    walls[j] &= ~m.opp;
    seen[j] = true;
    stack.push(j);
  }
  // knock out a few extra walls so there is more than one route
  for (let k = 0; k < 8; k++) {
    const i = Math.floor(Math.random() * N * N);
    const m = shuffle(Object.values(MOVES))[0];
    const r = Math.floor(i / N) + m.dr;
    const c = (i % N) + m.dc;
    if (r < 0 || r >= N || c < 0 || c >= N) continue;
    walls[i] &= ~m.bit;
    walls[r * N + c] &= ~m.opp;
  }
  // farthest cell from the dock gets the pallet
  const dist = Array(N * N).fill(-1);
  dist[0] = 0;
  const q = [0];
  while (q.length) {
    const i = q.shift()!;
    for (const m of Object.values(MOVES)) {
      if (walls[i] & m.bit) continue;
      const j = (Math.floor(i / N) + m.dr) * N + (i % N) + m.dc;
      if (dist[j] < 0) {
        dist[j] = dist[i] + 1;
        q.push(j);
      }
    }
  }
  const pallet = dist.indexOf(Math.max(...dist));
  return { walls, pallet };
}

export default function Forklift({ onFinish }: GameProps) {
  const [maze] = useState(makeMaze);
  const [pos, setPos] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [bumps, setBumps] = useState(0);
  const [shake, setShake] = useState(0);
  const elapsed = useElapsed();
  const done = useRef(false);

  const finish = (ok: boolean) => {
    if (done.current) return;
    done.current = true;
    const perf = ok ? timeFactor(elapsed(), 25_000, LIMIT, 0.6) * Math.max(0.5, 1 - 0.05 * bumps) : loaded ? 0.35 : 0;
    onFinish(perf, ok ? `Pallet delivered, ${bumps} bumps` : loaded ? "Picked up the pallet but never made it back" : "Never reached the pallet");
  };
  const timeLeft = useCountdown(LIMIT, () => finish(false));

  const move = (d: Dir) => {
    if (done.current) return;
    const m = MOVES[d];
    if (maze.walls[pos] & m.bit) {
      setBumps((b) => b + 1);
      setShake((s) => s + 1);
      return;
    }
    const np = (Math.floor(pos / N) + m.dr) * N + (pos % N) + m.dc;
    setPos(np);
    if (!loaded && np === maze.pallet) setLoaded(true);
    if (loaded && np === 0) setTimeout(() => finish(true), 300);
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const d = ({ ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" } as Record<string, Dir>)[e.key];
      if (d) {
        e.preventDefault();
        move(d);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const C = 40;
  const S = N * C;
  const r = Math.floor(pos / N);
  const c = pos % N;
  const pr = Math.floor(maze.pallet / N);
  const pc = maze.pallet % N;

  return (
    <div>
      <Hud left={loaded ? "Pallet loaded. Back to the dock" : "Drive to the pallet"} right={`${bumps} bumps`} timeLeft={timeLeft} limit={LIMIT} />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-center">
        <div key={shake} className={`rounded-2xl bg-raise border border-rule p-2 ${shake ? "boss-shake" : ""}`} style={{ ["--amp" as string]: "4px" }}>
          <svg viewBox={`-4 -4 ${S + 8} ${S + 8}`} className="w-full max-w-xs mx-auto block" data-walls={maze.walls.join(",")} data-pallet={maze.pallet}>
            <rect x="0" y="0" width={C} height={C} fill="#5CD38C" opacity="0.25" />
            <text x={C / 2} y={C / 2 + 4} textAnchor="middle" fontSize="10" fill="#5CD38C" fontWeight="700">DOCK</text>
            {!loaded && <text x={pc * C + C / 2} y={pr * C + C / 2 + 8} textAnchor="middle" fontSize="22">📦</text>}
            {maze.walls.map((w, i) => {
              const x = (i % N) * C;
              const y = Math.floor(i / N) * C;
              return (
                <g key={i} stroke="#9B9E92" strokeWidth="3" strokeLinecap="round">
                  {w & 1 ? <line x1={x} y1={y} x2={x + C} y2={y} /> : null}
                  {w & 2 ? <line x1={x + C} y1={y} x2={x + C} y2={y + C} /> : null}
                  {w & 4 ? <line x1={x} y1={y + C} x2={x + C} y2={y + C} /> : null}
                  {w & 8 ? <line x1={x} y1={y} x2={x} y2={y + C} /> : null}
                </g>
              );
            })}
            <g transform={`translate(${c * C + 6} ${r * C + 6})`} style={{ transition: "transform 120ms" }}>
              <rect width={C - 12} height={C - 12} rx="6" fill="#F1E05A" />
              {loaded && <rect x="6" y="6" width={C - 24} height={C - 24} rx="2" fill="#8A5A33" />}
            </g>
          </svg>
        </div>
        <div className="grid grid-cols-3 gap-2 w-44 mx-auto select-none">
          <span />
          <button className="btn btn-plain !rounded-xl !p-0 h-12" onPointerDown={() => move("up")} aria-label="Up">▲</button>
          <span />
          <button className="btn btn-plain !rounded-xl !p-0 h-12" onPointerDown={() => move("left")} aria-label="Left">◀</button>
          <button className="btn btn-plain !rounded-xl !p-0 h-12" onPointerDown={() => move("down")} aria-label="Down">▼</button>
          <button className="btn btn-plain !rounded-xl !p-0 h-12" onPointerDown={() => move("right")} aria-label="Right">▶</button>
        </div>
      </div>
      <p className="mt-3 text-[15px] text-inksoft">Pick up the pallet and bring it back to the dock. Walls are expensive.</p>
    </div>
  );
}
