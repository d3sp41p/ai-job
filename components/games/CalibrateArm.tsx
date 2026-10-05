"use client";

import { useEffect, useRef, useState } from "react";
import type { GameProps } from "./types";
import { Hud, rand, useCountdown } from "./kit";

const LIMIT = 40_000;
const DIALS = [
  { speed: 150, half: 26 },
  { speed: 210, half: 19 },
  { speed: 270, half: 13 },
];

export default function CalibrateArm({ onFinish }: GameProps) {
  const [zones] = useState(() => DIALS.map(() => 40 + rand(280)));
  const [dial, setDial] = useState(0);
  const [angles, setAngles] = useState([0, 0, 0]);
  const [locked, setLocked] = useState<(number | null)[]>([null, null, null]);
  const [misses, setMisses] = useState(0);
  const [msg, setMsg] = useState("Tap Lock when the needle is in the green zone.");
  const anglesRef = useRef([rand(360), rand(360), rand(360)]);
  const done = useRef(false);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      anglesRef.current = anglesRef.current.map((a, i) => (locked[i] === null ? (a + DIALS[i].speed * dt) % 360 : a));
      setAngles([...anglesRef.current]);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [locked]);

  const finish = (scores: (number | null)[], m: number) => {
    if (done.current) return;
    done.current = true;
    const s = scores.map((x) => x ?? 0);
    const perf = (s.reduce((a, b) => a + b, 0) / DIALS.length) * Math.max(0.4, 1 - 0.15 * m);
    onFinish(perf, `${s.filter((x) => x > 0).length} of ${DIALS.length} joints calibrated, ${m} misses`);
  };
  const timeLeft = useCountdown(LIMIT, () => finish(locked, misses));

  const lock = () => {
    if (done.current || dial >= DIALS.length) return;
    const a = anglesRef.current[dial];
    let d = Math.abs(a - zones[dial]) % 360;
    if (d > 180) d = 360 - d;
    if (d <= DIALS[dial].half) {
      const score = 1 - 0.4 * (d / DIALS[dial].half);
      const l = [...locked];
      l[dial] = score;
      setLocked(l);
      setMsg(score > 0.85 ? "Dead centre." : "Locked.");
      if (dial + 1 >= DIALS.length) setTimeout(() => finish(l, misses), 500);
      else setDial(dial + 1);
    } else {
      setMisses((m) => m + 1);
      setMsg("Missed. The arm just punched a wall.");
    }
  };

  return (
    <div>
      <Hud left={`Joint ${Math.min(dial + 1, 3)} of 3 · ${misses} misses`} timeLeft={timeLeft} limit={LIMIT} />
      <div className="grid grid-cols-3 gap-3">
        {DIALS.map((d, i) => {
          const z0 = zones[i] - d.half;
          const z1 = zones[i] + d.half;
          const arc = (deg: number) => {
            const r = (deg - 90) * (Math.PI / 180);
            return [50 + 40 * Math.cos(r), 50 + 40 * Math.sin(r)];
          };
          const [x0, y0] = arc(z0);
          const [x1, y1] = arc(z1);
          const nr = (angles[i] - 90) * (Math.PI / 180);
          return (
            <div key={i} className={`rounded-2xl border p-2 ${i === dial ? "border-marker bg-marker/5" : "border-rule bg-raise"}`}>
              <svg viewBox="0 0 100 100" className="w-full" aria-label={`Joint ${i + 1}`}>
                <circle cx="50" cy="50" r="40" fill="#0A0B09" stroke="#2A2E25" strokeWidth="6" />
                <path d={`M50 50 L${x0} ${y0} A40 40 0 0 1 ${x1} ${y1} Z`} fill="#5CD38C" opacity="0.85" />
                <line
                  x1="50"
                  y1="50"
                  x2={50 + 36 * Math.cos(nr)}
                  y2={50 + 36 * Math.sin(nr)}
                  stroke={locked[i] !== null ? "#5CD38C" : "#EEECE2"}
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <circle cx="50" cy="50" r="5" fill="#EEECE2" />
              </svg>
              <p className="text-center text-xs text-inksoft mt-1">{locked[i] !== null ? "Locked" : i === dial ? "Active" : "Waiting"}</p>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[15px] text-inksoft min-h-[1.5em]">{msg}</p>
      <button className="btn btn-marker w-full mt-2 select-none" onPointerDown={lock}>
        Lock joint {Math.min(dial + 1, 3)}
      </button>
    </div>
  );
}
