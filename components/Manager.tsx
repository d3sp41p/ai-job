"use client";

import { useEffect, useRef, useState } from "react";
import { useEmployee } from "@/lib/wallet";
import { LINES, moodFor, personalize, pick, type Mood } from "@/lib/manager";
import BossFace from "./BossFace";

// The AI manager in the office: comments on what you do.
export default function Manager({ compact = false }: { compact?: boolean }) {
  const emp = useEmployee();
  const [line, setLine] = useState("");
  const [typed, setTyped] = useState("");
  const lastEvent = useRef(Date.now());

  // First words, picked on the client so server and browser HTML match
  useEffect(() => {
    setLine((l) => l || pick(LINES.greeting));
  }, []);

  // React to events from the rest of the office
  useEffect(() => {
    if (emp.managerLine.id === 0) return;
    lastEvent.current = Date.now();
    setLine(emp.managerLine.text);
  }, [emp.managerLine]);

  // Idle chatter when nothing happens for a while
  useEffect(() => {
    const t = setInterval(() => {
      if (Date.now() - lastEvent.current > 14000) {
        lastEvent.current = Date.now();
        setLine(pick(LINES.idle));
      }
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const shown = personalize(line, emp.name);

  // Typewriter
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setTyped(shown);
      return;
    }
    setTyped("");
    let i = 0;
    const t = setInterval(() => {
      i++;
      setTyped(shown.slice(0, i));
      if (i >= shown.length) clearInterval(t);
    }, 24);
    return () => clearInterval(t);
  }, [shown]);

  const mood: Mood = moodFor(line);
  const typing = typed.length < shown.length;

  return (
    <div className={`flex items-start gap-4 ${compact ? "" : "sheet p-4 sm:p-5"}`}>
      <BossFace
        anger={mood === "displeased" ? 4 : 1}
        smug={mood === "pleased"}
        className="w-20 sm:w-24 shrink-0"
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm text-inksoft">Your manager</p>
        <p className="mt-1 text-[17px] leading-snug min-h-[3.2em]" aria-live="polite">
          <span key={line}>{typed}</span>
          <span
            className={`inline-block w-[0.55em] h-[1.05em] -mb-[0.15em] ml-0.5 bg-ink ${typing ? "" : "animate-pulse"}`}
            aria-hidden
          />
        </p>
      </div>
    </div>
  );
}
