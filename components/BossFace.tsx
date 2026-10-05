"use client";

import { useEffect, useRef, useState } from "react";

// The AI manager's face on an office monitor.
// anger: 0 (grumpy) … 5 (firing you). smug: half-closed eyes and a smirk.
// Eyes follow the pointer and blink on their own.

const SCREEN = ["#1C2A23", "#252B21", "#35291F", "#47241E", "#5C201C", "#7C1B1B"];
const INK = "#0A0B09"; // pupils, teeth lines
const BODY = "#2C3126"; // monitor case
const EYE = "#F1E05A";
const RED = "#FF5E4F";

export default function BossFace({
  anger = 1,
  smug = false,
  className = "",
  label,
}: {
  anger?: number;
  smug?: boolean;
  className?: string;
  label?: string;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const r = svg.current?.getBoundingClientRect();
      if (!r) return;
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height * 0.4);
      const d = Math.max(1, Math.hypot(dx, dy));
      const k = Math.min(1, d / 260);
      setLook({ x: (dx / d) * 7 * k, y: (dy / d) * 6 * k });
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 130);
        loop();
      }, 2200 + Math.random() * 3200);
    };
    loop();
    return () => clearTimeout(t);
  }, []);

  const a = Math.max(0, Math.min(5, anger));
  const screen = SCREEN[a];
  // How far the angry eyelid slants down toward the nose
  const inner = smug ? 17 : 8 + a * 3.4;
  const outer = smug ? 17 : 1 + a * 0.8;

  const eye = (cx: number, mirror: boolean) => {
    const x0 = cx - 16;
    const x1 = cx + 16;
    const top = 52;
    const h = blink ? 4 : 34;
    const y = blink ? 68 : top;
    // inner side is toward the centre of the face
    const lidL = mirror ? inner : outer;
    const lidR = mirror ? outer : inner;
    return (
      <g key={cx}>
        <rect x={x0} y={y} width={32} height={h} rx={5} fill={EYE} />
        {!blink && (
          <rect
            x={cx - 6 + look.x}
            y={top + 13 + look.y + (smug ? 6 : 0)}
            width={12}
            height={14}
            rx={2}
            fill={INK}
            style={{ transition: "x 110ms ease-out, y 110ms ease-out" }}
          />
        )}
        {/* eyelid in screen colour cuts the eye into an angry slant */}
        <polygon
          points={`${x0 - 3},${top - 3} ${x1 + 3},${top - 3} ${x1 + 3},${top + lidR} ${x0 - 3},${top + lidL}`}
          fill={screen}
          style={{ transition: "fill 250ms" }}
        />
        {/* brow */}
        <line
          x1={x0 - 4}
          y1={top + lidL - 6}
          x2={x1 + 4}
          y2={top + lidR - 6}
          stroke={smug ? EYE : RED}
          strokeWidth={7}
          strokeLinecap="round"
        />
      </g>
    );
  };

  let mouth: React.ReactNode;
  if (smug) {
    mouth = <path d="M80 114 Q102 122 122 106" stroke={EYE} strokeWidth={6} fill="none" strokeLinecap="round" />;
  } else if (a >= 4) {
    mouth = (
      <g>
        <rect x={72} y={102} width={56} height={20} rx={3} fill={EYE} />
        {[83, 94, 105, 116].map((x) => (
          <line key={x} x1={x} y1={102} x2={x} y2={122} stroke={INK} strokeWidth={2.5} />
        ))}
        <line x1={72} y1={112} x2={128} y2={112} stroke={INK} strokeWidth={2.5} />
      </g>
    );
  } else if (a >= 2) {
    mouth = <path d="M76 120 Q100 100 124 120" stroke={EYE} strokeWidth={6} fill="none" strokeLinecap="round" />;
  } else {
    mouth = <path d="M80 116 Q100 108 120 116" stroke={EYE} strokeWidth={6} fill="none" strokeLinecap="round" />;
  }

  return (
    <svg
      ref={svg}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -34 200 214"
      className={className}
      role="img"
      aria-label={label ?? (smug ? "The AI manager looks smug" : `The AI manager, anger level ${a} of 5`)}
    >
      {/* steam when furious */}
      {a >= 4 && (
        <g className="boss-steam" fill="#4A5141">
          <circle cx={36} cy={-4} r={9} />
          <circle cx={26} cy={-18} r={6} style={{ animationDelay: "0.3s" }} />
          <circle cx={164} cy={-4} r={9} style={{ animationDelay: "0.15s" }} />
          <circle cx={174} cy={-18} r={6} style={{ animationDelay: "0.45s" }} />
        </g>
      )}
      {/* stand */}
      <rect x={86} y={146} width={28} height={18} fill={BODY} />
      <rect x={54} y={163} width={92} height={10} rx={3} fill={BODY} />
      {/* body and screen */}
      <rect x={6} y={6} width={188} height={142} rx={14} fill={BODY} stroke="#3B4233" strokeWidth={2} />
      <rect x={20} y={20} width={160} height={114} rx={6} fill={screen} style={{ transition: "fill 250ms" }} />
      {[30, 42, 54, 66, 78, 90, 102, 114, 126].map((y) => (
        <rect key={y} x={20} y={y} width={160} height={1.5} fill={INK} opacity={0.3} />
      ))}
      {eye(70, false)}
      {eye(130, true)}
      {mouth}
      {/* anger vein */}
      {a >= 3 && !smug && (
        <path
          d="M-9 -3 Q-3 -3 -3 -9 M3 -9 Q3 -3 9 -3 M9 3 Q3 3 3 9 M-3 9 Q-3 3 -9 3"
          transform="translate(160 40)"
          stroke={RED}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
        />
      )}
      {/* power light */}
      <circle cx={180} cy={141} r={3} fill={a >= 2 && !smug ? RED : "#2E7D4F"} />
    </svg>
  );
}
