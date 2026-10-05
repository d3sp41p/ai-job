"use client";

import { useRef, useState } from "react";
import type { GameProps } from "./types";
import { Hud, pickOne, rand, shuffle, timeFactor, useCountdown, useElapsed } from "./kit";

const TRASH = ["📄", "🥤", "🍌", "🧃", "🗞️", "🍕", "💾", "🧦", "🥫", "📦"];
const LIMIT = 30_000;

type Item = { id: number; icon: string; coin: boolean; x: number; y: number; gone: boolean };

function makeItems(): Item[] {
  const icons = shuffle(TRASH).slice(0, 6);
  const spots = shuffle(Array.from({ length: 12 }, (_, i) => i)).slice(0, 7);
  const all = [...icons.map((icon) => ({ icon, coin: false })), { icon: "🪙", coin: true }];
  return all.map((it, i) => ({
    id: i,
    icon: it.icon,
    coin: it.coin,
    // 4x3 grid of spots in the top-left area, with jitter
    x: 6 + (spots[i] % 4) * 15 + rand(6),
    y: 8 + Math.floor(spots[i] / 4) * 24 + rand(8),
    gone: false,
  }));
}

export default function TakeOutTrash({ onFinish }: GameProps) {
  const area = useRef<HTMLDivElement>(null);
  const bin = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState(makeItems);
  const [drag, setDrag] = useState<{ id: number; x: number; y: number } | null>(null);
  const [coinTrashed, setCoinTrashed] = useState(false);
  const [msg, setMsg] = useState(pickOne(["Drag the trash into the bin.", "Everything goes. Except the coin."]));
  const elapsed = useElapsed();
  const done = useRef(false);

  const trashLeft = items.filter((i) => !i.coin && !i.gone).length;
  const total = items.filter((i) => !i.coin).length;

  const finish = (timedOut = false) => {
    if (done.current) return;
    done.current = true;
    const binned = total - items.filter((i) => !i.coin && !i.gone).length;
    let perf = (binned / total) * (timedOut ? 0.7 : timeFactor(elapsed(), 9000, LIMIT));
    if (coinTrashed) perf *= 0.5;
    onFinish(perf, `${binned} of ${total} items binned${coinTrashed ? ", and you threw away a coin" : ""}`);
  };
  const timeLeft = useCountdown(LIMIT, () => finish(true));

  const toLocal = (cx: number, cy: number) => {
    const r = area.current!.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * 100, y: ((cy - r.top) / r.height) * 100 };
  };

  const drop = (id: number, cx: number, cy: number) => {
    const b = bin.current!.getBoundingClientRect();
    const inBin = cx > b.left - 10 && cx < b.right + 10 && cy > b.top - 10 && cy < b.bottom + 10;
    const p = toLocal(cx, cy);
    setItems((all) =>
      all.map((it) => {
        if (it.id !== id) return it;
        if (inBin) {
          if (it.coin) {
            setCoinTrashed(true);
            setMsg("You threw away money. The AI saw that.");
          } else setMsg(pickOne(["Good.", "Bin it.", "Next.", "Efficient."]));
          return { ...it, gone: true };
        }
        return { ...it, x: Math.max(0, Math.min(88, p.x - 6)), y: Math.max(0, Math.min(80, p.y - 8)) };
      })
    );
    setDrag(null);
  };

  return (
    <div>
      <Hud left={`${total - trashLeft}/${total} binned`} timeLeft={timeLeft} limit={LIMIT} />
      <div ref={area} className="relative h-72 rounded-2xl bg-raise border border-rule overflow-hidden select-none touch-none">
        <p className="absolute left-4 bottom-3 text-sm text-inksoft max-w-[55%]">{msg}</p>
        <div
          ref={bin}
          className={`absolute right-4 bottom-4 w-24 h-28 rounded-b-2xl rounded-t-md border-2 flex items-center justify-center text-4xl ${
            drag ? "border-marker bg-marker/10" : "border-rule bg-paper"
          }`}
        >
          🗑️
        </div>
        {items
          .filter((it) => !it.gone)
          .map((it) => {
            const pos = drag?.id === it.id ? { x: drag.x - 6, y: drag.y - 8 } : { x: it.x, y: it.y };
            return (
              <button
                key={it.id}
                aria-label={it.coin ? "A coin" : "Trash"}
                className={`absolute w-14 h-14 rounded-xl flex flex-col items-center justify-center text-3xl leading-none cursor-grab active:cursor-grabbing ${
                  drag?.id === it.id ? "z-10 scale-110" : ""
                }`}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                onPointerDown={(e) => {
                  (e.target as Element).setPointerCapture(e.pointerId);
                  const p = toLocal(e.clientX, e.clientY);
                  setDrag({ id: it.id, ...p });
                }}
                onPointerMove={(e) => drag?.id === it.id && setDrag({ id: it.id, ...toLocal(e.clientX, e.clientY) })}
                onPointerUp={(e) => drag?.id === it.id && drop(it.id, e.clientX, e.clientY)}
              >
                {it.icon}
                {it.coin && <span className="text-[10px] font-mono text-marker mt-0.5">$HIRED</span>}
              </button>
            );
          })}
      </div>
      <button className="btn btn-marker w-full mt-4" disabled={trashLeft > 0} onClick={() => finish()}>
        {trashLeft > 0 ? `Bin ${trashLeft} more` : "Pull the lever"}
      </button>
    </div>
  );
}
