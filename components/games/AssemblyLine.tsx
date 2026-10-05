"use client";

import { useEffect, useRef, useState } from "react";
import type { GameProps } from "./types";
import { Hud, rand } from "./kit";

const PARTS = [
  { id: "bolt", icon: "🔩", name: "Bolts" },
  { id: "gear", icon: "⚙️", name: "Gears" },
  { id: "chip", icon: "💾", name: "Chips" },
];
const COUNT = 14;
const durFor = (k: number) => 3200 - (1500 * k) / (COUNT - 1); // belt speeds up

export default function AssemblyLine({ onFinish }: GameProps) {
  const [k, setK] = useState(0); // part number
  const [part, setPart] = useState(() => rand(PARTS.length));
  const [pos, setPos] = useState(0); // 0..1 along the belt
  const [correct, setCorrect] = useState(0);
  const [missed, setMissed] = useState(0);
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);
  const t0 = useRef(performance.now());
  const done = useRef(false);
  const stats = useRef({ correct: 0 });

  const next = (result: "ok" | "bad" | "miss") => {
    if (done.current) return;
    if (result === "ok") stats.current.correct++;
    setCorrect(stats.current.correct);
    if (result === "miss") setMissed((m) => m + 1);
    setFlash(result === "ok" ? "ok" : "bad");
    setTimeout(() => setFlash(null), 200);
    if (k + 1 >= COUNT) {
      done.current = true;
      setTimeout(() => onFinish(stats.current.correct / COUNT, `${stats.current.correct} of ${COUNT} parts sorted`), 300);
      return;
    }
    setK(k + 1);
    setPart(rand(PARTS.length));
    t0.current = performance.now();
    setPos(0);
  };

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const p = (performance.now() - t0.current) / durFor(k);
      if (p >= 1) {
        next("miss");
        return;
      }
      setPos(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);

  return (
    <div>
      <Hud left={`Part ${Math.min(k + 1, COUNT)} of ${COUNT}`} right={`${correct} sorted · ${missed} fell off`} />
      <div
        className={`relative h-36 rounded-2xl bg-raise border overflow-hidden ${
          flash === "ok" ? "border-ok" : flash === "bad" ? "border-stamp" : "border-rule"
        }`}
      >
        {/* belt */}
        <div className="absolute inset-x-0 bottom-8 h-10 bg-paper belt-stripes" />
        <div className="absolute right-0 bottom-0 top-0 w-10 bg-gradient-to-l from-stamp/30 to-transparent" aria-hidden />
        <div className="absolute bottom-[3.2rem] text-5xl -translate-x-1/2" style={{ left: `${6 + pos * 88}%` }}>
          {PARTS[part].icon}
        </div>
      </div>
      <p className="mt-3 text-sm text-inksoft">Tap the right box before the part falls off the belt.</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {PARTS.map((p, i) => (
          <button key={p.id} className="btn btn-plain !rounded-2xl !flex-col !py-4 select-none" onPointerDown={() => next(i === part ? "ok" : "bad")}>
            <span className="text-3xl">{p.icon}</span>
            <span className="text-sm">{p.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
