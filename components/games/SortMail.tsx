"use client";

import { useRef, useState } from "react";
import type { GameProps } from "./types";
import { Hud, shuffle, timeFactor, useCountdown, useElapsed } from "./kit";

const LIMIT = 25_000;
const DEPTS = [
  { id: "acc", label: "Accounting", icon: "💰" },
  { id: "hr", label: "HR", icon: "🧑‍💼" },
  { id: "legal", label: "Legal", icon: "⚖️" },
  { id: "shred", label: "Shred", icon: "🗑️" },
] as const;
type Dept = (typeof DEPTS)[number]["id"];

const MAIL: { from: string; subject: string; dept: Dept }[] = [
  { from: "Vendor Ltd", subject: "Invoice #4821 is overdue", dept: "acc" },
  { from: "Bank", subject: "Quarterly statement attached", dept: "acc" },
  { from: "Tax office", subject: "Your filing is due Friday", dept: "acc" },
  { from: "Dana, warehouse", subject: "Vacation request: 2 weeks", dept: "hr" },
  { from: "New hire", subject: "Where do I pick up my badge?", dept: "hr" },
  { from: "Team lead", subject: "Complaint about the AI manager", dept: "hr" },
  { from: "Court clerk", subject: "Notice of lawsuit", dept: "legal" },
  { from: "Patent office", subject: "Trademark application update", dept: "legal" },
  { from: "Ex-employee", subject: "Signed NDA, please confirm", dept: "legal" },
  { from: "Prince of Nowhere", subject: "You won a free yacht!!!", dept: "shred" },
  { from: "crypto-pump-bot", subject: "1000x GUARANTEED, act now", dept: "shred" },
  { from: "Unknown", subject: "Hot singles in your server rack", dept: "shred" },
];
const COUNT = 8;

export default function SortMail({ onFinish }: GameProps) {
  const [queue] = useState(() => shuffle(MAIL).slice(0, COUNT));
  const [i, setI] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);
  const elapsed = useElapsed();
  const done = useRef(false);

  const finish = (c: number, timedOut = false) => {
    if (done.current) return;
    done.current = true;
    const perf = (c / COUNT) * (timedOut ? 1 : timeFactor(elapsed(), 14_000, LIMIT, 0.8));
    onFinish(perf, `${c} of ${COUNT} letters in the right tray`);
  };
  const timeLeft = useCountdown(LIMIT, () => finish(correct, true));

  const sort = (d: Dept) => {
    if (done.current) return;
    const ok = queue[i].dept === d;
    const c = correct + (ok ? 1 : 0);
    setCorrect(c);
    setFlash(ok ? "ok" : "bad");
    setTimeout(() => setFlash(null), 220);
    if (i + 1 >= COUNT) finish(c);
    else setI(i + 1);
  };

  const m = queue[i];
  return (
    <div>
      <Hud left={`Letter ${Math.min(i + 1, COUNT)} of ${COUNT}`} timeLeft={timeLeft} limit={LIMIT} />
      <div
        key={i}
        className={`rounded-2xl bg-[#E9E5D6] text-paper p-5 min-h-[9rem] transition-colors ${
          flash === "ok" ? "ring-4 ring-ok" : flash === "bad" ? "ring-4 ring-stamp" : ""
        }`}
        style={{ animation: "memo-in 240ms ease-out" }}
      >
        <div className="flex justify-between text-sm opacity-70">
          <span>From: {m.from}</span>
          <span>✉️</span>
        </div>
        <p className="mt-4 font-condensed text-2xl font-black leading-tight">{m.subject}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {DEPTS.map((d) => (
          <button key={d.id} className="btn btn-plain !rounded-2xl !flex-col !py-4" onClick={() => sort(d.id)}>
            <span className="text-2xl">{d.icon}</span>
            <span className="text-sm">{d.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
