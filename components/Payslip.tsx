"use client";

import { useState } from "react";
import { shortAddr, STATS } from "@/lib/mock";
import { useEmployee } from "@/lib/wallet";
import ShareDialog from "./ShareDialog";

// The salary receipt for an hourly payout.
export default function Payslip({
  amount,
  address,
  tx,
  title,
  tasks,
  days,
  onClose,
}: {
  amount: number;
  address: string;
  tx: string;
  title: string;
  tasks: number;
  days: number;
  onClose: () => void;
}) {
  const [share, setShare] = useState(false);
  const emp = useEmployee();
  const no = tx.slice(0, 6).toUpperCase();
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start sm:items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Payslip">
      <div className="w-full max-w-sm">
        {/* printer */}
        <div className="bg-raise border border-rule h-10 rounded-t-2xl relative">
          <div className="absolute left-6 right-6 bottom-2 h-1.5 bg-paper rounded-full" />
          <div className="absolute right-3 top-3 h-2 w-2 rounded-full bg-ok" />
        </div>
        {/* paper comes out of the slot */}
        <div className="overflow-hidden mx-6">
          <div className="print-out bg-sheet border-x border-b border-rule px-5 pt-5 pb-6 relative">
            <p className="text-center font-condensed text-2xl font-black">Payslip</p>
            <p className="text-center text-xs text-inksoft">No. {no} · Treasury {STATS.treasurySol} SOL</p>
            <dl className="mt-5 grid grid-cols-[1fr_auto] gap-y-1.5 text-sm border-t border-dashed border-rule pt-3">
              <dt className="text-inksoft">Employee</dt>
              <dd>{emp.name && address === emp.address ? `${emp.name} (${shortAddr(address)})` : shortAddr(address)}</dd>
              <dt className="text-inksoft">Employer</dt>
              <dd>The AI</dd>
              <dt className="text-inksoft">Paid in</dt>
              <dd>SOL</dd>
              <dt className="text-inksoft">Network fee</dt>
              <dd>Paid by the AI</dd>
            </dl>
            <div className="mt-3 border-t border-dashed border-rule pt-3 flex justify-between items-baseline">
              <span className="font-semibold">Net salary</span>
              <span className="font-condensed text-3xl font-black">{amount.toFixed(3)} SOL</span>
            </div>
            <a
              href={`https://solscan.io/tx/${tx}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block text-sm underline underline-offset-4"
            >
              View transaction on Solscan
            </a>
            <div className="absolute right-4 top-4 text-xl stamp stamp-animate" style={{ animationDelay: "1.7s" }}>
              Paid
            </div>
            {/* torn edge */}
            <div
              className="absolute left-0 right-0 -bottom-[7px] h-2"
              style={{
                background:
                  "linear-gradient(-45deg, transparent 4px, #121410 0) 0 0/8px 8px repeat-x, linear-gradient(45deg, transparent 4px, #121410 0) 0 0/8px 8px repeat-x",
              }}
              aria-hidden
            />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button className="btn btn-primary" onClick={() => setShare(true)}>
            Share on X
          </button>
          <button className="btn btn-marker" onClick={onClose}>
            Back to work
          </button>
        </div>
        {share && (
          <ShareDialog
            card={{ kind: "salary", amount, title, tasks, days, address }}
            onClose={() => setShare(false)}
          />
        )}
      </div>
    </div>
  );
}
