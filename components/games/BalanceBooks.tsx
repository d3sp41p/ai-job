"use client";

import { useRef, useState } from "react";
import type { GameProps } from "./types";
import { Hud, clamp01, rand, shuffle, timeFactor, useCountdown, useElapsed } from "./kit";

const LIMIT = 90_000;
const ROWS = 10;
const ERRORS = 3;
const DESCS = ["Server rent", "Coffee beans", "GPU cluster", "Office plants", "Cleaning service", "Electricity", "Paperclips (bulk)", "Robot insurance", "Printer toner", "Internet", "Snacks for humans", "Cable ties", "Desk chairs"];

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// A believable bookkeeping mistake: swapped digits, or off by a power of ten
function mistake(n: number) {
  const s = fmt(n);
  const digits = s.replace(/[^0-9]/g, "");
  if (Math.random() < 0.6 && digits.length >= 4) {
    // swap two neighbouring different digits
    const chars = s.split("");
    const idx = chars.map((ch, i) => i).filter((i) => /\d/.test(chars[i]) && /\d/.test(chars[i + 1] ?? "") && chars[i] !== chars[i + 1]);
    if (idx.length) {
      const i = idx[rand(idx.length)];
      [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
      return chars.join("");
    }
  }
  return fmt(n + (Math.random() < 0.5 ? 10 : 100) * (Math.random() < 0.5 ? 1 : -1));
}

function makeBooks() {
  const descs = shuffle(DESCS).slice(0, ROWS);
  const wrong = new Set(shuffle(Array.from({ length: ROWS }, (_, i) => i)).slice(0, ERRORS));
  return descs.map((d, i) => {
    const amount = 120 + rand(9800) + rand(100) / 100;
    const receipt = fmt(amount);
    let ledger = receipt;
    if (wrong.has(i)) {
      ledger = mistake(amount);
      if (ledger === receipt) ledger = fmt(amount + 10);
    }
    return { desc: d, receipt, ledger, wrong: wrong.has(i) };
  });
}

export default function BalanceBooks({ onFinish }: GameProps) {
  const [rows] = useState(makeBooks);
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const elapsed = useElapsed();
  const done = useRef(false);

  const finish = (timedOut = false) => {
    if (done.current) return;
    done.current = true;
    const found = rows.filter((r, i) => r.wrong && flagged.has(i)).length;
    const wrongFlags = rows.filter((r, i) => !r.wrong && flagged.has(i)).length;
    const perf = clamp01((found - 0.5 * wrongFlags) / ERRORS) * (timedOut ? 0.8 : timeFactor(elapsed(), 40_000, LIMIT, 0.75));
    onFinish(perf, `${found} of ${ERRORS} errors found, ${wrongFlags} correct rows flagged by mistake`);
  };
  const timeLeft = useCountdown(LIMIT, () => finish(true));

  const toggle = (i: number) =>
    setFlagged((f) => {
      const n = new Set(f);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });

  return (
    <div>
      <Hud left={`Find the ${ERRORS} rows where the ledger doesn't match the receipt · ${flagged.size} flagged`} timeLeft={timeLeft} limit={LIMIT} />
      <div className="rounded-2xl border border-rule overflow-hidden">
        <table className="w-full text-left text-[13px] sm:text-sm font-mono">
          <thead className="bg-raise text-inksoft">
            <tr>
              <th className="font-normal px-3 py-2">Item</th>
              <th className="font-normal px-2 py-2 text-right">Receipt</th>
              <th className="font-normal px-3 py-2 text-right">Ledger</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                onClick={() => toggle(i)}
                className={`border-t border-rule cursor-pointer select-none ${flagged.has(i) ? "bg-stamp/15" : "hover:bg-raise"}`}
              >
                <td className="px-3 py-2 font-sans">{flagged.has(i) ? "🚩 " : ""}{r.desc}</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.receipt}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.ledger}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[15px] text-inksoft">Tap a row to flag it. The AI replaced the accountants and now needs someone to check its work.</p>
      <button className="btn btn-marker w-full mt-2" onClick={() => finish()} disabled={flagged.size === 0}>
        Submit audit
      </button>
    </div>
  );
}
