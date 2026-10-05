"use client";

import { useEffect, useRef, useState } from "react";
import BossFace from "./BossFace";
import { BOSS_LINES, MOOD_NAMES, POKE_LINES, personalize } from "@/lib/manager";
import { useEmployee } from "@/lib/wallet";

// Homepage toy: poke the AI manager. Every poke makes him angrier,
// he calms down if you leave him alone, and at the top he fires you.
export default function BossDesk() {
  const emp = useEmployee();
  const [anger, setAnger] = useState(0);
  const [line, setLine] = useState("");
  const [typed, setTyped] = useState("");
  const [pokes, setPokes] = useState(0);
  const [stamp, setStamp] = useState<"Fired" | "Rehired" | null>(null);
  const lastPoke = useRef(0);
  const lastLine = useRef("");
  const peak = useRef(0);
  const firing = useRef(false);

  useEffect(() => {
    setLine(BOSS_LINES.hello);
  }, []);

  // Cools down one level every few seconds when left alone
  useEffect(() => {
    const t = setInterval(() => {
      if (firing.current || Date.now() - lastPoke.current < 3500) return;
      setAnger((a) => {
        if (a === 0) return 0;
        const next = a - 1;
        if (next === 0 && peak.current >= 3) {
          peak.current = 0;
          setLine(BOSS_LINES.calm);
        }
        return next;
      });
    }, 1800);
    return () => clearInterval(t);
  }, []);

  const shown = personalize(line, emp.name);

  // Typewriter
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTyped(shown);
      return;
    }
    setTyped("");
    let i = 0;
    const t = setInterval(() => {
      i++;
      setTyped(shown.slice(0, i));
      if (i >= shown.length) clearInterval(t);
    }, 20);
    return () => clearInterval(t);
  }, [shown]);

  const poke = () => {
    if (firing.current) return;
    lastPoke.current = Date.now();
    setPokes((p) => p + 1);
    const next = Math.min(5, anger + 1);
    setAnger(next);
    peak.current = Math.max(peak.current, next);

    const pool = POKE_LINES[next].filter((l) => l !== lastLine.current);
    const chosen = pool[Math.floor(Math.random() * pool.length)] ?? POKE_LINES[next][0];
    lastLine.current = chosen;
    setLine(chosen);

    if (next === 5) {
      firing.current = true;
      setStamp("Fired");
      setTimeout(() => {
        setStamp("Rehired");
        setAnger(2);
        peak.current = 2;
        setLine(BOSS_LINES.rehired);
        firing.current = false;
        lastPoke.current = Date.now();
      }, 2600);
      setTimeout(() => setStamp((s) => (s === "Rehired" ? null : s)), 5200);
    }
  };

  const typing = typed.length < shown.length;
  const shouting = line === line.toUpperCase() && line.length > 0;

  return (
    <div className="sheet relative">
      <div className="bg-raise text-ink px-4 py-2.5 flex items-center justify-between text-sm">
        <span className="font-semibold">Head of Human Resources</span>
        <span className="flex items-center gap-2 text-ink/60">
          <span className={`h-2 w-2 rounded-full ${anger >= 2 ? "bg-stamp animate-pulse" : "bg-ok"}`} aria-hidden />
          AI, online
        </span>
      </div>

      <div className="p-4 sm:p-5">
        {/* speech bubble */}
        <div className="relative border border-rule bg-paper rounded-2xl px-4 py-3 min-h-[5.5rem]">
          <p
            className={`leading-snug ${shouting ? "font-condensed font-black text-2xl text-stamp" : "text-[17px]"}`}
            aria-live="polite"
          >
            <span key={line}>{typed}</span>
            <span
              className={`inline-block w-[0.5em] h-[1em] -mb-[0.12em] ml-0.5 bg-ink ${typing ? "" : "animate-pulse"}`}
              aria-hidden
            />
          </p>
          <span
            className="absolute -bottom-[11px] left-1/2 -translate-x-1/2 w-5 h-5 bg-paper border-r border-b border-rule rotate-45"
            aria-hidden
          />
        </div>

        {/* the boss */}
        <button
          onClick={poke}
          aria-label="Poke the AI manager"
          className="group mt-4 block mx-auto w-full max-w-[17rem] cursor-pointer select-none touch-manipulation"
        >
          <div key={pokes} className={pokes ? "boss-shake" : ""} style={{ ["--amp" as string]: `${2 + anger * 2.2}px` }}>
            <BossFace anger={anger} className="w-full transition-transform group-hover:-translate-y-0.5 group-active:scale-95" />
          </div>
        </button>

        {/* mood meter */}
        <div className="mt-3">
          <div className="flex justify-between items-baseline text-sm">
            <span className="text-inksoft">Mood</span>
            <span className={`font-semibold ${anger >= 3 ? "text-stamp" : ""}`}>{MOOD_NAMES[anger]}</span>
          </div>
          <div className="mt-1.5 grid grid-cols-5 gap-1" aria-hidden>
            {[1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className="h-2 rounded-full bg-raise transition-colors duration-200"
                style={{ background: anger >= i ? (i >= 4 ? "#FF5E4F" : i >= 3 ? "#FF9A3C" : "#F1E05A") : "transparent" }}
              />
            ))}
          </div>
          <p className="mt-2 text-sm text-inksoft">
            {pokes === 0 ? "Click the manager. He loves it." : `You have interrupted the AI ${pokes} ${pokes === 1 ? "time" : "times"}.`}
          </p>
        </div>
      </div>

      {stamp && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden>
          <div
            key={stamp}
            className="text-5xl sm:text-6xl stamp stamp-animate"
            style={{ animationDelay: "0ms", mixBlendMode: "normal", background: "#0A0B09", maskImage: "none", WebkitMaskImage: "none" }}
          >
            {stamp}
          </div>
        </div>
      )}
    </div>
  );
}
