"use client";

import { shortAddr } from "@/lib/mock";
import { useStats } from "@/lib/stats";

// Scrolling strip of the latest salaries, like a stock ticker in the lobby.
export default function PayTicker() {
  const { recentPayouts } = useStats();
  if (!recentPayouts.length) return null;
  const items = recentPayouts.map((p) => (
    <span key={p.tx} className="inline-flex items-center gap-2 px-6">
      <span className="h-1.5 w-1.5 rounded-full bg-marker" aria-hidden />
      <span className="text-ink/60">{shortAddr(p.address)} got paid</span>
      <span className="font-semibold text-marker">{p.amountSol.toFixed(3)} SOL</span>
    </span>
  ));
  return (
    <div className="bg-raise border-b border-rule text-ink text-[13px] font-mono overflow-hidden ticker" translate="no" aria-label="Latest salaries">
      <div className="ticker-track whitespace-nowrap py-1.5">
        {items}
        <span aria-hidden>{items}</span>
      </div>
    </div>
  );
}
