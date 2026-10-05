"use client";

import { useRef, useState } from "react";
import type { GameProps } from "./types";
import { Hud, rand, shuffle, timeFactor, useCountdown, useElapsed } from "./kit";

const LIMIT = 60_000;
const ITEMS = [
  { id: "mug", icon: "☕", name: "Mug" },
  { id: "kbd", icon: "⌨️", name: "Keyboard" },
  { id: "bat", icon: "🔋", name: "Battery" },
  { id: "plug", icon: "🔌", name: "Cable" },
  { id: "mouse", icon: "🖱️", name: "Mouse" },
  { id: "phones", icon: "🎧", name: "Headphones" },
  { id: "plant", icon: "🪴", name: "Plant" },
  { id: "clip", icon: "📎", name: "Paperclips" },
];
const ORDERS = 3;
type Order = Record<string, number>;

function makeOrder(): Order {
  const kinds = shuffle(ITEMS).slice(0, 2 + rand(2));
  const o: Order = {};
  kinds.forEach((k) => (o[k.id] = 1 + rand(3)));
  return o;
}
const same = (a: Order, b: Order) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((k) => (a[k] ?? 0) === (b[k] ?? 0));
};

export default function PackOrders({ onFinish }: GameProps) {
  const [orders] = useState(() => Array.from({ length: ORDERS }, makeOrder));
  const [n, setN] = useState(0);
  const [box, setBox] = useState<Order>({});
  const [errors, setErrors] = useState(0);
  const [msg, setMsg] = useState("Tap items on the shelf to pack them. Tap an item in the box to take it out.");
  const elapsed = useElapsed();
  const done = useRef(false);

  const finish = (shipped: number, e: number, timedOut = false) => {
    if (done.current) return;
    done.current = true;
    const perf = (shipped / ORDERS) * (timedOut ? 1 : timeFactor(elapsed(), 30_000, LIMIT, 0.7)) * Math.max(0.4, 1 - 0.15 * e);
    onFinish(perf, `${shipped} of ${ORDERS} orders shipped, ${e} sent back`);
  };
  const timeLeft = useCountdown(LIMIT, () => finish(n, errors, true));

  const add = (id: string) => setBox((b) => ({ ...b, [id]: (b[id] ?? 0) + 1 }));
  const remove = (id: string) =>
    setBox((b) => {
      const c = { ...b, [id]: (b[id] ?? 0) - 1 };
      if (c[id] <= 0) delete c[id];
      return c;
    });

  const ship = () => {
    if (done.current) return;
    if (same(box, orders[n])) {
      setBox({});
      setMsg("Shipped. Next order.");
      if (n + 1 >= ORDERS) finish(n + 1, errors);
      else setN(n + 1);
    } else {
      setErrors((e) => e + 1);
      setMsg("Wrong contents. The customer would be furious. Repack it.");
    }
  };

  const order = orders[Math.min(n, ORDERS - 1)];
  const itemById = (id: string) => ITEMS.find((i) => i.id === id)!;

  return (
    <div>
      <Hud left={`Order ${Math.min(n + 1, ORDERS)} of ${ORDERS} · ${errors} returned`} timeLeft={timeLeft} limit={LIMIT} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-[#E9E5D6] text-paper p-4">
          <p className="text-sm opacity-70">Packing slip #{1040 + n}</p>
          <ul className="mt-2 space-y-1">
            {Object.entries(order).map(([id, q]) => (
              <li key={id} className="flex justify-between font-semibold">
                <span>
                  {itemById(id).icon} {itemById(id).name}
                </span>
                <span>× {q}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border-2 border-dashed border-rule bg-raise p-4 min-h-[8rem]">
          <p className="text-sm text-inksoft">Box</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(box).flatMap(([id, q]) =>
              Array.from({ length: q }, (_, k) => (
                <button key={id + k} onClick={() => remove(id)} className="text-2xl w-10 h-10 rounded-lg bg-paper" aria-label={`Remove ${itemById(id).name}`}>
                  {itemById(id).icon}
                </button>
              ))
            )}
            {Object.keys(box).length === 0 && <span className="text-inksoft text-sm">Empty</span>}
          </div>
        </div>
      </div>
      <p className="mt-3 text-sm text-inksoft">Shelf</p>
      <div className="mt-1 grid grid-cols-4 gap-2">
        {ITEMS.map((it) => (
          <button key={it.id} onClick={() => add(it.id)} className="btn btn-plain !rounded-2xl !flex-col !py-2 !px-1">
            <span className="text-2xl">{it.icon}</span>
            <span className="text-[11px] font-normal">{it.name}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-[15px] text-inksoft min-h-[1.5em]">{msg}</p>
      <button className="btn btn-marker w-full mt-2" onClick={ship} disabled={Object.keys(box).length === 0}>
        Seal and ship
      </button>
    </div>
  );
}
