"use client";

import { useRef, useState } from "react";
import type { GameProps } from "./types";
import { Hud, shuffle, timeFactor, useCountdown, useElapsed } from "./kit";

const LIMIT = 50_000;
const COUNT = 6;
// First reply is the right one; options are shuffled on screen
const TICKETS: { from: string; text: string; replies: string[] }[] = [
  {
    from: "Gary, accounts",
    text: "My password stopped working after I changed it this morning.",
    replies: ["Let's reset it. I've sent a reset link to your work email.", "Have you tried being a better person?", "Passwords are a social construct."],
  },
  {
    from: "Mrs. Patel",
    text: "I was charged twice for the same order.",
    replies: ["Sorry about that. I've refunded the duplicate charge, it'll show in 3–5 days.", "Twice the order, twice the joy.", "Please hold for 4 to 6 business years."],
  },
  {
    from: "Tom",
    text: "My toaster became sentient and refuses to toast.",
    replies: ["Unplug it for 30 seconds and plug it back in. If it still refuses, we'll replace it.", "Congratulations on your new coworker.", "Have you asked it nicely?"],
  },
  {
    from: "Lena",
    text: "The AI fired me. How do I appeal?",
    replies: ["I'm sorry. Here's the appeal form, and I've flagged your case for a human review.", "The AI is never wrong.", "Have you considered being more like the AI?"],
  },
  {
    from: "Dave",
    text: "Where's my package? Tracking hasn't moved in a week.",
    replies: ["I've opened a trace with the courier and I'll email you an update within 24 hours.", "Packages need alone time too.", "It's in a better place now."],
  },
  {
    from: "Ana",
    text: "Can I change my delivery address? I moved.",
    replies: ["Sure. Reply with the new address and I'll update the order before it ships.", "No. Move back.", "We only deliver to your old life."],
  },
  {
    from: "Ivan",
    text: "The app crashes every time I open it.",
    replies: ["Please update to the latest version. If it still crashes, send me your phone model and I'll escalate it.", "Works on my machine.", "Have you tried not opening it?"],
  },
  {
    from: "Priya",
    text: "I want to cancel my subscription.",
    replies: ["Done. Your subscription is cancelled and you won't be charged again.", "Are you sure? Are you really sure? Are you SURE?", "Cancellation is a premium feature."],
  },
];

export default function SupportCalls({ onFinish }: GameProps) {
  const [queue] = useState(() =>
    shuffle(TICKETS)
      .slice(0, COUNT)
      .map((t) => ({ ...t, options: shuffle(t.replies.map((r, i) => ({ r, ok: i === 0 }))) }))
  );
  const [i, setI] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [flash, setFlash] = useState<number | null>(null);
  const elapsed = useElapsed();
  const done = useRef(false);

  const finish = (c: number, timedOut = false) => {
    if (done.current) return;
    done.current = true;
    const perf = (c / COUNT) * (timedOut ? 1 : timeFactor(elapsed(), 25_000, LIMIT, 0.85));
    onFinish(perf, `${c} of ${COUNT} customers helped`);
  };
  const timeLeft = useCountdown(LIMIT, () => finish(correct, true));

  const answer = (k: number) => {
    if (done.current || flash !== null) return;
    const ok = queue[i].options[k].ok;
    const c = correct + (ok ? 1 : 0);
    setCorrect(c);
    setFlash(k);
    setTimeout(() => {
      setFlash(null);
      if (i + 1 >= COUNT) finish(c);
      else setI(i + 1);
    }, 450);
  };

  const t = queue[i];
  return (
    <div>
      <Hud left={`Ticket ${Math.min(i + 1, COUNT)} of ${COUNT} · ${correct} resolved`} timeLeft={timeLeft} limit={LIMIT} />
      <div className="rounded-2xl bg-raise border border-rule p-4">
        <p className="text-sm text-inksoft">📞 {t.from}</p>
        <p className="mt-1 text-lg font-semibold">&ldquo;{t.text}&rdquo;</p>
      </div>
      <p className="mt-3 text-sm text-inksoft">Pick the reply that actually helps:</p>
      <div className="mt-2 grid gap-2">
        {t.options.map((o, k) => (
          <button
            key={k}
            onClick={() => answer(k)}
            className={`text-left rounded-2xl border px-4 py-3 transition-colors ${
              flash === k ? (o.ok ? "border-ok bg-ok/10" : "border-stamp bg-stamp/10") : "border-rule bg-sheet hover:border-inksoft"
            }`}
          >
            {o.r}
          </button>
        ))}
      </div>
    </div>
  );
}
