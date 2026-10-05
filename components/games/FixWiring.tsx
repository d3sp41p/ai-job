"use client";

import { useRef, useState } from "react";
import type { GameProps } from "./types";
import { Hud, shuffle, timeFactor, useCountdown, useElapsed } from "./kit";

const LIMIT = 45_000;
// Colour + symbol so colour-blind employees can match too
const WIRES = [
  { c: "#FF5E4F", s: "●" },
  { c: "#4FA3FF", s: "▲" },
  { c: "#F1E05A", s: "■" },
  { c: "#5CD38C", s: "◆" },
  { c: "#C77DFF", s: "★" },
  { c: "#FF9A3C", s: "✚" },
];
const W = 320;
const H = 300;
const yAt = (i: number) => 30 + i * 48;
const LX = 44;
const RX = W - 44;

export default function FixWiring({ onFinish }: GameProps) {
  const svg = useRef<SVGSVGElement>(null);
  const [left] = useState(() => shuffle(WIRES.map((_, i) => i)));
  const [right] = useState(() => shuffle(WIRES.map((_, i) => i)));
  const [links, setLinks] = useState<number[]>([]); // wire ids connected
  const [drag, setDrag] = useState<{ wire: number; from: number; x: number; y: number } | null>(null);
  const [errors, setErrors] = useState(0);
  const [msg, setMsg] = useState("Drag each wire to the socket with the same colour and symbol.");
  const elapsed = useElapsed();
  const done = useRef(false);

  const finish = (n: number, e: number, timedOut = false) => {
    if (done.current) return;
    done.current = true;
    const perf = timedOut ? (n / WIRES.length) * 0.6 : timeFactor(elapsed(), 15_000, LIMIT) * Math.max(0, 1 - 0.12 * e);
    onFinish(perf, `${n} of ${WIRES.length} wires connected, ${e} wrong plugs`);
  };
  const timeLeft = useCountdown(LIMIT, () => finish(links.length, errors, true));

  const toSvg = (cx: number, cy: number) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * W, y: ((cy - r.top) / r.height) * H };
  };

  const end = (cx: number, cy: number) => {
    if (!drag) return;
    const p = toSvg(cx, cy);
    const slot = right.findIndex((_, i) => Math.hypot(p.x - RX, p.y - yAt(i)) < 30);
    if (slot >= 0) {
      if (right[slot] === drag.wire) {
        const l = [...links, drag.wire];
        setLinks(l);
        setMsg(l.length === WIRES.length ? "Power restored." : "Connected.");
        if (l.length === WIRES.length) setTimeout(() => finish(l.length, errors), 500);
      } else {
        setErrors((e) => e + 1);
        setMsg("Wrong socket. Sparks. The AI felt that.");
      }
    }
    setDrag(null);
  };

  return (
    <div>
      <Hud left={`${links.length}/${WIRES.length} connected · ${errors} wrong`} timeLeft={timeLeft} limit={LIMIT} />
      <div className="rounded-2xl bg-raise border border-rule p-3">
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full max-w-md mx-auto block touch-none select-none"
          onPointerMove={(e) => drag && setDrag({ ...drag, ...toSvg(e.clientX, e.clientY) })}
          onPointerUp={(e) => end(e.clientX, e.clientY)}
        >
          <rect x="8" y="8" width="56" height={H - 16} rx="10" fill="#0A0B09" stroke="#2A2E25" />
          <rect x={W - 64} y="8" width="56" height={H - 16} rx="10" fill="#0A0B09" stroke="#2A2E25" />
          {links.map((w) => {
            const li = left.indexOf(w);
            const ri = right.indexOf(w);
            return (
              <path
                key={w}
                d={`M${LX} ${yAt(li)} C ${W / 2} ${yAt(li)}, ${W / 2} ${yAt(ri)}, ${RX} ${yAt(ri)}`}
                stroke={WIRES[w].c}
                strokeWidth="9"
                fill="none"
                strokeLinecap="round"
              />
            );
          })}
          {drag && (
            <line x1={LX} y1={yAt(drag.from)} x2={drag.x} y2={drag.y} stroke={WIRES[drag.wire].c} strokeWidth="9" strokeLinecap="round" />
          )}
          {left.map((w, i) => (
            <g
              key={`l${w}`}
              onPointerDown={(e) => {
                if (links.includes(w) || done.current) return;
                (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
                setDrag({ wire: w, from: i, ...toSvg(e.clientX, e.clientY) });
              }}
              style={{ cursor: links.includes(w) ? "default" : "grab" }}
            >
              <rect x={10} y={yAt(i) - 9} width={LX - 10} height={18} rx={4} fill={WIRES[w].c} />
              <circle cx={LX} cy={yAt(i)} r={13} fill={WIRES[w].c} stroke="#0A0B09" strokeWidth="3" />
              <text x={LX} y={yAt(i) + 5} textAnchor="middle" fontSize="13" fill="#0A0B09" fontWeight="700">{WIRES[w].s}</text>
              <circle cx={LX} cy={yAt(i)} r={24} fill="transparent" />
            </g>
          ))}
          {right.map((w, i) => (
            <g key={`r${w}`}>
              <rect x={RX} y={yAt(i) - 9} width={W - 10 - RX} height={18} rx={4} fill={WIRES[w].c} />
              <circle cx={RX} cy={yAt(i)} r={13} fill="#0A0B09" stroke={WIRES[w].c} strokeWidth="4" />
              <text x={RX} y={yAt(i) + 5} textAnchor="middle" fontSize="13" fill={WIRES[w].c} fontWeight="700">{WIRES[w].s}</text>
            </g>
          ))}
        </svg>
      </div>
      <p className="mt-3 text-[15px] text-inksoft min-h-[1.5em]">{msg}</p>
    </div>
  );
}
