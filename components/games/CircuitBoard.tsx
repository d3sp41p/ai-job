"use client";

import { useMemo, useRef, useState } from "react";
import type { GameProps } from "./types";
import { Hud, rand, timeFactor, useCountdown, useElapsed } from "./kit";

const LIMIT = 90_000;
const N = 5;
// Connection bits: N=1, E=2, S=4, W=8
const N_ = 1, E_ = 2, S_ = 4, W_ = 8;
const rot = (m: number) => ((m << 1) | (m >> 3)) & 15;
const rotN = (m: number, r: number) => {
  let x = m;
  for (let i = 0; i < r; i++) x = rot(x);
  return x;
};
const BASES = [N_ | S_, N_ | E_, N_ | E_ | S_]; // straight, corner, tee

type Board = { base: number[]; rot: number[]; start: number; end: number };

function makeBoard(): Board {
  // Build a path column by column: vertical run, then step east
  const masks = Array(N * N).fill(0);
  const onPath = Array(N * N).fill(false);
  let row = rand(N);
  const start = row;
  let enter = W_;
  for (let c = 0; c < N; c++) {
    const target = c === N - 1 ? rand(N) : rand(N);
    const step = target > row ? 1 : -1;
    while (true) {
      const idx = row * N + c;
      const atTarget = row === target;
      const exit = atTarget ? E_ : step === 1 ? S_ : N_;
      masks[idx] = enter | exit;
      onPath[idx] = true;
      if (atTarget) break;
      row += step;
      enter = step === 1 ? N_ : S_;
    }
    enter = W_;
  }
  const end = row;
  const base: number[] = [];
  const correctRot: number[] = [];
  for (let i = 0; i < N * N; i++) {
    if (onPath[i]) {
      // find which base + rotation makes this mask
      let found = false;
      for (const b of [0, 1]) {
        for (let r = 0; r < 4; r++) {
          if (rotN(BASES[b], r) === masks[i]) {
            base.push(b);
            correctRot.push(r);
            found = true;
            break;
          }
        }
        if (found) break;
      }
    } else {
      base.push(rand(3));
      correctRot.push(rand(4));
    }
  }
  // Scramble: every path tile starts rotated wrong
  const r = correctRot.map((cr, i) =>
    onPath[i] ? (base[i] === 0 ? (cr + (rand(2) ? 1 : 3)) % 4 : (cr + 1 + rand(3)) % 4) : rand(4)
  );
  return { base, rot: r, start, end };
}

function powered(b: Board): Set<number> {
  const mask = (i: number) => rotN(BASES[b.base[i]], b.rot[i]);
  const seen = new Set<number>();
  const s = b.start * N;
  if (!(mask(s) & W_)) return seen;
  const q = [s];
  seen.add(s);
  while (q.length) {
    const i = q.shift()!;
    const r = Math.floor(i / N);
    const c = i % N;
    const m = mask(i);
    const nb: [number, number, number, number][] = [
      [r - 1, c, N_, S_],
      [r, c + 1, E_, W_],
      [r + 1, c, S_, N_],
      [r, c - 1, W_, E_],
    ];
    for (const [rr, cc, out, inn] of nb) {
      if (rr < 0 || rr >= N || cc < 0 || cc >= N) continue;
      const j = rr * N + cc;
      if (seen.has(j)) continue;
      if (m & out && mask(j) & inn) {
        seen.add(j);
        q.push(j);
      }
    }
  }
  return seen;
}

export default function CircuitBoard({ onFinish }: GameProps) {
  const [board, setBoard] = useState(makeBoard);
  const [moves, setMoves] = useState(0);
  const elapsed = useElapsed();
  const done = useRef(false);

  const live = useMemo(() => powered(board), [board]);
  const endIdx = board.end * N + (N - 1);
  const solved = live.has(endIdx) && (rotN(BASES[board.base[endIdx]], board.rot[endIdx]) & E_) > 0;

  const finish = (ok: boolean) => {
    if (done.current) return;
    done.current = true;
    const perf = ok ? timeFactor(elapsed(), 30_000, LIMIT, 0.6) * Math.max(0.75, 1 - Math.max(0, moves - 30) * 0.01) : (live.size / (N * 2)) * 0.4;
    onFinish(Math.min(1, perf), ok ? `Circuit closed in ${moves} turns` : "The chip never got power");
  };
  const timeLeft = useCountdown(LIMIT, () => finish(false));

  const turn = (i: number) => {
    if (done.current || solved) return;
    const b = { ...board, rot: board.rot.map((r, k) => (k === i ? (r + 1) % 4 : r)) };
    setBoard(b);
    setMoves((m) => m + 1);
    const lv = powered(b);
    const ei = b.end * N + (N - 1);
    if (lv.has(ei) && rotN(BASES[b.base[ei]], b.rot[ei]) & E_) setTimeout(() => finish(true), 600);
  };

  const C = 56; // cell size in svg units
  const pad = 30;
  const size = N * C + pad * 2;

  return (
    <div>
      <Hud left={`${moves} turns · tap a tile to rotate it`} timeLeft={timeLeft} limit={LIMIT} />
      <div className="rounded-2xl bg-[#0E2A1C] border border-rule p-2">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-sm mx-auto block select-none" data-start={board.start} data-end={board.end}>
          {/* battery and chip */}
          <g transform={`translate(4 ${pad + board.start * C + C / 2 - 14})`}>
            <rect width="22" height="28" rx="4" fill="#F1E05A" />
            <text x="11" y="19" textAnchor="middle" fontSize="14" fontWeight="800" fill="#0A0B09">+</text>
          </g>
          <g transform={`translate(${size - 26} ${pad + board.end * C + C / 2 - 14})`}>
            <rect width="22" height="28" rx="3" fill={solved ? "#5CD38C" : "#2C3126"} stroke="#EEECE2" strokeWidth="1.5" />
          </g>
          {board.base.map((b, i) => {
            const r = Math.floor(i / N);
            const c = i % N;
            const x = pad + c * C;
            const y = pad + r * C;
            const on = live.has(i);
            const m = rotN(BASES[b], board.rot[i]);
            const col = on ? "#F1E05A" : "#6C7A5E";
            const cx = x + C / 2;
            const cy = y + C / 2;
            return (
              <g key={i} onClick={() => turn(i)} style={{ cursor: "pointer" }} data-tile={i} data-base={b} data-rot={board.rot[i]}>
                <rect x={x + 2} y={y + 2} width={C - 4} height={C - 4} rx="8" fill="#123524" stroke="#1E4A33" />
                {m & N_ ? <line x1={cx} y1={cy} x2={cx} y2={y + 2} stroke={col} strokeWidth="8" strokeLinecap="round" /> : null}
                {m & E_ ? <line x1={cx} y1={cy} x2={x + C - 2} y2={cy} stroke={col} strokeWidth="8" strokeLinecap="round" /> : null}
                {m & S_ ? <line x1={cx} y1={cy} x2={cx} y2={y + C - 2} stroke={col} strokeWidth="8" strokeLinecap="round" /> : null}
                {m & W_ ? <line x1={cx} y1={cy} x2={x + 2} y2={cy} stroke={col} strokeWidth="8" strokeLinecap="round" /> : null}
                <circle cx={cx} cy={cy} r="7" fill={col} />
              </g>
            );
          })}
        </svg>
      </div>
      <p className="mt-3 text-[15px] text-inksoft">
        {solved ? "Power reaches the chip. Nice soldering." : "Rotate the tiles so power flows from the battery on the left to the chip on the right."}
      </p>
    </div>
  );
}
