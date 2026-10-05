"use client";

import { useEffect, useRef, useState } from "react";
import type { GameProps } from "./types";
import { Hud, clamp01, rand, useCountdown } from "./kit";

const LIMIT = 30_000;
const CUPS = [
  { name: "Espresso", w: 70, h: 90 },
  { name: "Mug", w: 96, h: 120 },
  { name: "Thermos", w: 70, h: 160 },
];

export default function RefillCoffee({ onFinish }: GameProps) {
  const [cup, setCup] = useState(0);
  const [fill, setFill] = useState(0);
  const [pouring, setPouring] = useState(false);
  const [targets] = useState(() => CUPS.map(() => 50 + rand(36)));
  const [scores, setScores] = useState<number[]>([]);
  const [msg, setMsg] = useState("Hold the button. Release on the line.");
  const fillRef = useRef(0);
  const pouringRef = useRef(false);
  const done = useRef(false);

  const finish = (s: number[]) => {
    if (done.current) return;
    done.current = true;
    const all = [...s, ...Array(CUPS.length - s.length).fill(0)];
    const perf = all.reduce((a, b) => a + b, 0) / CUPS.length;
    onFinish(perf, `${s.filter((x) => x > 0.5).length} of ${CUPS.length} cups filled right`);
  };
  const timeLeft = useCountdown(LIMIT, () => finish(scores));

  useEffect(() => {
    if (!pouring) return;
    const t = setInterval(() => {
      fillRef.current = Math.min(110, fillRef.current + 1.2);
      setFill(fillRef.current);
      if (fillRef.current >= 110) stop();
    }, 30);
    const up = () => stop();
    window.addEventListener("pointerup", up);
    return () => {
      clearInterval(t);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pouring]);

  const stop = () => {
    if (!pouringRef.current) return;
    pouringRef.current = false;
    setPouring(false);
    const f = fillRef.current;
    const target = targets[cup];
    const score = f > 100 ? 0 : clamp01(1 - Math.abs(f - target) / 12);
    setMsg(f > 100 ? "You spilled coffee on the server. Unacceptable." : score > 0.85 ? "Perfect pour." : score > 0.4 ? "Close enough. Barely." : "That is not the line.");
    const s = [...scores, score];
    setScores(s);
    setTimeout(() => {
      if (cup + 1 >= CUPS.length) finish(s);
      else {
        setCup(cup + 1);
        fillRef.current = 0;
        setFill(0);
      }
    }, 900);
  };

  const c = CUPS[cup];
  const target = targets[cup];

  return (
    <div>
      <Hud left={`Cup ${cup + 1} of ${CUPS.length}: ${c.name}`} timeLeft={timeLeft} limit={LIMIT} />
      <div className="rounded-2xl bg-raise border border-rule h-64 flex items-end justify-center pb-6 relative overflow-hidden select-none">
        {/* machine spout */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-10 bg-paper border border-rule rounded-b-xl" />
        {pouring && fill < 110 && <div className="absolute top-10 left-1/2 -translate-x-1/2 w-2 bottom-6 bg-[#8A5A33]" />}
        <div className="relative border-[3px] border-ink/80 border-t-0 rounded-b-2xl overflow-hidden bg-paper" style={{ width: c.w, height: c.h }}>
          <div className="absolute inset-x-0 bottom-0 bg-[#8A5A33]" style={{ height: `${Math.min(100, fill)}%` }} />
          <div className="absolute inset-x-0 border-t-2 border-dashed border-marker" style={{ bottom: `${target}%` }} />
        </div>
        {fill > 100 && <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-40 h-3 rounded-full bg-[#8A5A33]/70" />}
      </div>
      <p className="mt-3 text-[15px] text-inksoft min-h-[1.5em]">{msg}</p>
      <button
        className={`btn btn-marker w-full mt-2 select-none touch-none ${pouring ? "!bg-[#8A5A33] !text-ink" : ""}`}
        onPointerDown={(e) => {
          e.preventDefault();
          if (done.current || pouring || scores.length > cup) return;
          pouringRef.current = true;
          setPouring(true);
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {pouring ? "Pouring… release on the line" : "Hold to pour"}
      </button>
    </div>
  );
}
