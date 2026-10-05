"use client";

import BossFace from "./BossFace";

const STEPS = ["More holders", "More trading", "More fees", "Bigger treasury", "Bigger salaries"];

// The growth loop, drawn as a wheel with a coin running around it.
export default function Flywheel() {
  const R = 38; // % of the box, radius of the wheel
  return (
    <div className="relative mx-auto w-full max-w-[30rem] aspect-square">
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" aria-hidden>
        <defs>
          <marker id="fw-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 Z" fill="#EEECE2" />
          </marker>
        </defs>
        <circle cx="50" cy="50" r={R} fill="none" stroke="#EEECE2" strokeWidth="0.8" strokeDasharray="2 2" />
        {STEPS.map((_, i) => {
          // arrows between nodes, along the circle
          const a0 = ((i / STEPS.length) * 360 - 90 + 16) * (Math.PI / 180);
          const a1 = (((i + 1) / STEPS.length) * 360 - 90 - 16) * (Math.PI / 180);
          return (
            <path
              key={i}
              d={`M ${50 + R * Math.cos(a0)} ${50 + R * Math.sin(a0)} A ${R} ${R} 0 0 1 ${50 + R * Math.cos(a1)} ${50 + R * Math.sin(a1)}`}
              fill="none"
              stroke="#EEECE2"
              strokeWidth="1.2"
              markerEnd="url(#fw-arrow)"
            />
          );
        })}
        <circle r="2.6" fill="#F1E05A" stroke="#0A0B09" strokeWidth="0.8" className="fw-coin">
          <animateMotion dur="7s" repeatCount="indefinite" path={`M 50 ${50 - R} A ${R} ${R} 0 1 1 49.99 ${50 - R}`} />
        </circle>
      </svg>

      {STEPS.map((s, i) => {
        const a = ((i / STEPS.length) * 360 - 90) * (Math.PI / 180);
        const left = 50 + R * Math.cos(a);
        const top = 50 + R * Math.sin(a);
        const last = i === STEPS.length - 1;
        return (
          <div
            key={s}
            className={`absolute -translate-x-1/2 -translate-y-1/2 border border-rule rounded-full px-3 py-1.5 text-center text-[13px] sm:text-[15px] font-semibold leading-tight w-[6.5rem] sm:w-[8rem] ${
              last ? "bg-marker text-paper" : "bg-sheet"
            }`}
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            {s}
          </div>
        );
      })}

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[34%] text-center">
        <BossFace anger={0} smug className="w-full" />
        <p className="text-[11px] sm:text-sm font-semibold leading-tight mt-1">100% of fees go to workers</p>
      </div>
    </div>
  );
}
