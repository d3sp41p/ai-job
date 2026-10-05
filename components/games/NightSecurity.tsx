"use client";

import { useEffect, useRef, useState } from "react";
import type { GameProps } from "./types";
import { Hud, clamp01, rand } from "./kit";

const LENGTH = 40_000;
const VISIBLE = 1500;
type Kind = "robot" | "cat" | "janitor";
const ICON: Record<Kind, string> = { robot: "🤖", cat: "🐈", janitor: "🧹" };
type Ev = { at: number; cam: number; kind: Kind };

function schedule(): Ev[] {
  const evs: Ev[] = [];
  let t = 1500;
  while (t < LENGTH - 1500) {
    const r = Math.random();
    evs.push({ at: t, cam: rand(4), kind: r < 0.62 ? "robot" : r < 0.85 ? "cat" : "janitor" });
    t += 1400 + rand(1400);
  }
  return evs;
}

export default function NightSecurity({ onFinish }: GameProps) {
  const [events] = useState(schedule);
  const [now, setNow] = useState(0);
  const [handled, setHandled] = useState<Set<number>>(new Set());
  const [stats, setStats] = useState({ caught: 0, falseAlarms: 0 });
  const [flash, setFlash] = useState<{ cam: number; ok: boolean } | null>(null);
  const t0 = useRef(performance.now());
  const done = useRef(false);
  const robots = events.filter((e) => e.kind === "robot").length;

  useEffect(() => {
    const t = setInterval(() => {
      const n = performance.now() - t0.current;
      setNow(n);
      if (n >= LENGTH && !done.current) {
        done.current = true;
        setStats((s) => {
          const perf = clamp01((s.caught - 0.5 * s.falseAlarms) / robots);
          setTimeout(() => onFinish(perf, `${s.caught} of ${robots} robots caught, ${s.falseAlarms} false alarms`), 0);
          return s;
        });
      }
    }, 50);
    return () => clearInterval(t);
  }, [onFinish, robots]);

  const activeOn = (cam: number) => events.findIndex((e, i) => e.cam === cam && !handled.has(i) && now >= e.at && now < e.at + VISIBLE);

  const tap = (cam: number) => {
    if (done.current) return;
    const i = activeOn(cam);
    if (i >= 0 && events[i].kind === "robot") {
      setHandled((h) => new Set(h).add(i));
      setStats((s) => ({ ...s, caught: s.caught + 1 }));
      setFlash({ cam, ok: true });
    } else {
      if (i >= 0) setHandled((h) => new Set(h).add(i));
      setStats((s) => ({ ...s, falseAlarms: s.falseAlarms + 1 }));
      setFlash({ cam, ok: false });
    }
    setTimeout(() => setFlash(null), 300);
  };

  return (
    <div>
      <Hud left={`${stats.caught} caught · ${stats.falseAlarms} false alarms`} timeLeft={Math.max(0, LENGTH - now)} limit={LENGTH} />
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((cam) => {
          const i = activeOn(cam);
          const ev = i >= 0 ? events[i] : null;
          return (
            <button
              key={cam}
              onPointerDown={() => tap(cam)}
              className={`relative h-32 sm:h-36 rounded-2xl bg-[#07120C] border-2 overflow-hidden select-none ${
                flash?.cam === cam ? (flash.ok ? "border-ok" : "border-stamp") : "border-rule"
              }`}
              aria-label={`Camera ${cam + 1}`}
            >
              <div className="absolute inset-0 cam-noise opacity-30" aria-hidden />
              <span className="absolute left-2 top-2 text-[11px] font-mono text-ok/80">CAM {cam + 1} ● REC</span>
              {ev && <span className="absolute inset-0 flex items-center justify-center text-5xl" style={{ filter: "grayscale(0.4) brightness(0.9)" }}>{ICON[ev.kind]}</span>}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[15px] text-inksoft">Tap a camera when a robot shows up. Cats and the janitor are allowed.</p>
    </div>
  );
}
