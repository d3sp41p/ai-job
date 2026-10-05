"use client";

// A mug that empties as the break runs out. `left` goes from 1 (full) to 0.
export default function CoffeeBreak({ left }: { left: number }) {
  const h = 34 * Math.max(0, Math.min(1, left));
  return (
    <svg viewBox="0 0 80 80" className="w-24 sm:w-28 shrink-0" role="img" aria-label="Coffee break">
      {/* steam */}
      <g className="steam" stroke="#9B9E92" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity={left > 0.05 ? 1 : 0}>
        <path d="M28 18 q-4 -5 0 -10 q4 -5 0 -10" />
        <path d="M38 18 q-4 -5 0 -10 q4 -5 0 -10" style={{ animationDelay: "0.6s" }} />
        <path d="M48 18 q-4 -5 0 -10 q4 -5 0 -10" style={{ animationDelay: "1.2s" }} />
      </g>
      <clipPath id="mug-inside">
        <rect x="18" y="26" width="40" height="40" rx="3" />
      </clipPath>
      {/* coffee */}
      <rect x="18" y={66 - h} width="40" height={h} fill="#8A5A33" clipPath="url(#mug-inside)" style={{ transition: "y 1s linear, height 1s linear" }} />
      {/* mug */}
      <rect x="16" y="24" width="44" height="44" rx="4" fill="none" stroke="#EEECE2" strokeWidth="3.5" />
      <path d="M60 34 h6 a8 8 0 0 1 0 16 h-6" fill="none" stroke="#EEECE2" strokeWidth="3.5" />
      <rect x="10" y="70" width="56" height="4" rx="2" fill="#EEECE2" />
    </svg>
  );
}
