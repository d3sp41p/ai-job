"use client";

import { useRef, useState } from "react";
import type { GameProps } from "./types";
import { Hud, pickOne, rand, timeFactor, useCountdown, useElapsed } from "./kit";

const LIMIT = 90_000;
const VENDORS = ["Bolt & Byte Supply", "Northwind Parts", "Acme Server Racks", "Kettle Coffee Co.", "Grey Goose Logistics"];

function makeInvoice() {
  const pad = (n: number, l: number) => String(n).padStart(l, "0");
  const total = (100 + rand(4900)) + rand(100) / 100;
  return {
    vendor: pickOne(VENDORS),
    fields: [
      { key: "inv", label: "Invoice number", value: `INV-${pad(10000 + rand(89999), 5)}`, mode: "text" as const },
      { key: "date", label: "Date (YYYY-MM-DD)", value: `2026-${pad(1 + rand(9), 2)}-${pad(1 + rand(28), 2)}`, mode: "text" as const },
      { key: "vendor", label: "Vendor ID", value: pad(1000000 + rand(8999999), 7), mode: "numeric" as const },
      { key: "qty", label: "Quantity", value: String(1 + rand(480)), mode: "numeric" as const },
      { key: "total", label: "Total (USD)", value: total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), mode: "decimal" as const },
    ],
  };
}
const norm = (s: string) => s.trim().toUpperCase().replace(/[\s,$]/g, "");

export default function DataEntry({ onFinish }: GameProps) {
  const [inv] = useState(makeInvoice);
  const [vals, setVals] = useState<Record<string, string>>({});
  const elapsed = useElapsed();
  const done = useRef(false);

  const finish = (timedOut = false) => {
    if (done.current) return;
    done.current = true;
    const ok = inv.fields.filter((f) => norm(vals[f.key] ?? "") === norm(f.value)).length;
    const perf = (ok / inv.fields.length) * (timedOut ? 0.8 : timeFactor(elapsed(), 35_000, LIMIT, 0.7));
    onFinish(perf, `${ok} of ${inv.fields.length} fields entered correctly`);
  };
  const timeLeft = useCountdown(LIMIT, () => finish(true));

  return (
    <div>
      <Hud left="Copy the invoice into the form, exactly" timeLeft={timeLeft} limit={LIMIT} />
      <div className="grid gap-4 md:grid-cols-2">
        {/* the "scan" */}
        <div className="rounded-xl bg-[#E9E5D6] text-[#2B2A25] p-4 font-mono text-[13px] leading-relaxed rotate-[-1deg] shadow-lg select-none" style={{ filter: "blur(0.35px) contrast(0.92)" }}>
          <p className="font-bold text-[15px]">{inv.vendor}</p>
          <p className="opacity-70">INVOICE · scanned copy</p>
          <div className="mt-3 border-t border-dashed border-[#2B2A25]/40 pt-2 space-y-1">
            {inv.fields.map((f) => (
              <p key={f.key} className="flex justify-between gap-3">
                <span className="opacity-70">{f.label.replace(" (YYYY-MM-DD)", "").replace(" (USD)", "")}</span>
                <span className="font-bold">{f.key === "total" ? `$${f.value}` : f.value}</span>
              </p>
            ))}
          </div>
          <p className="mt-3 opacity-50 text-[11px]">Thank you for your business. OCR unavailable. A human will type this.</p>
        </div>
        {/* the form */}
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            finish();
          }}
        >
          {inv.fields.map((f) => (
            <label key={f.key} className="grid gap-1 text-sm">
              <span className="text-inksoft">{f.label}</span>
              <input
                id={`de-${f.key}`}
                inputMode={f.mode}
                autoComplete="off"
                spellCheck={false}
                value={vals[f.key] ?? ""}
                onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
                className="border border-rule rounded-xl bg-paper px-3 py-2 font-mono text-[15px]"
              />
            </label>
          ))}
          <button className="btn btn-marker mt-2">Submit invoice</button>
        </form>
      </div>
    </div>
  );
}
