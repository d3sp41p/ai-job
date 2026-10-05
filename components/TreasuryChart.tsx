"use client";

import { useState } from "react";
import { fmtSol, niceMax } from "@/lib/format";

// Treasury balance over time: one series, area + line, hover shows the day.
export default function TreasuryChart({ data, height = 160, areaOpacity = 0.55 }: { data: number[]; height?: number; areaOpacity?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = height;
  const pad = { l: 8, r: 8, t: 16, b: 22 };
  const max = niceMax(Math.max(...data));
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / (data.length - 1);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const line = data.map((v, i) => `${i ? "L" : "M"}${x(i)} ${y(v)}`).join(" ");
  const area = `${line} L${x(data.length - 1)} ${H - pad.b} L${x(0)} ${H - pad.b} Z`;
  const last = data.length - 1;
  const h = hover ?? last;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Treasury went from ${fmtSol(data[0])} to ${fmtSol(data[last])} SOL over ${last} days`}
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * last);
          setHover(Math.max(0, Math.min(last, i)));
        }}
        onPointerLeave={() => setHover(null)}
      >
        {[0.5, 1].map((k) => (
          <line key={k} x1={pad.l} x2={W - pad.r} y1={y(max * k)} y2={y(max * k)} stroke="currentColor" opacity="0.15" strokeWidth="1" />
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="currentColor" opacity="0.4" strokeWidth="1" />
        <path d={area} fill="#F1E05A" opacity={areaOpacity} />
        <path d={line} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <line x1={x(h)} x2={x(h)} y1={pad.t} y2={H - pad.b} stroke="currentColor" opacity={hover === null ? 0 : 0.35} strokeWidth="1" />
        <circle cx={x(h)} cy={y(data[h])} r="5.5" fill="#F1E05A" stroke="currentColor" strokeWidth="2.5" />
        <text x={pad.l} y={H - 5} fontSize="12" fill="currentColor" opacity="0.7">
          {last === 1 ? "Yesterday" : `${last} days ago`}
        </text>
        <text x={W - pad.r} y={H - 5} fontSize="12" textAnchor="end" fill="currentColor" opacity="0.7">
          Today
        </text>
        <text x={pad.l + 2} y={y(max) - 4} fontSize="12" fill="currentColor" opacity="0.7">
          {fmtSol(max)} SOL
        </text>
      </svg>
      {hover !== null && (
        <div
          className="absolute -top-2 -translate-x-1/2 -translate-y-full bg-ink text-paper text-xs px-2 py-1 whitespace-nowrap pointer-events-none"
          style={{ left: `${(x(hover) / W) * 100}%` }}
        >
          {hover === last ? "Today" : `${last - hover} days ago`}: {fmtSol(data[hover])} SOL
        </div>
      )}
    </div>
  );
}
