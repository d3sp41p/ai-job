"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { rankFor, TOKEN_TICKER } from "@/lib/config";
import { mockResume, shortAddr } from "@/lib/mock";
import ShareDialog from "@/components/ShareDialog";

const isSolanaAddress = (a: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);

function ResumeInner() {
  const params = useSearchParams();
  const router = useRouter();
  const address = params.get("address") ?? "";
  const [input, setInput] = useState(address);
  const [error, setError] = useState("");
  const [share, setShare] = useState(false);

  useEffect(() => setInput(address), [address]);

  const lookup = (e: React.FormEvent) => {
    e.preventDefault();
    const a = input.trim();
    if (!isSolanaAddress(a)) {
      setError("That doesn't look like a Solana address. Paste the full wallet address.");
      return;
    }
    setError("");
    router.push(`/resume/?address=${a}`);
  };

  const r = address && isSolanaAddress(address) ? mockResume(address) : null;
  const rank = r ? rankFor(r.tasks) : null;


  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <h1 className="font-condensed text-6xl md:text-7xl font-black leading-[0.9]">Resumes</h1>
      <p className="mt-3 max-w-xl text-inksoft">
        Look up any employee by wallet address. Read-only, no wallet connection needed.
      </p>

      <form onSubmit={lookup} className="mt-6 flex flex-col sm:flex-row gap-2 max-w-2xl">
        <label htmlFor="addr" className="sr-only">Wallet address</label>
        <input
          id="addr"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste a Solana wallet address"
          className="flex-1 min-w-0 border border-rule rounded-full bg-sheet px-5 py-3"
          spellCheck={false}
        />
        <button className="btn btn-primary">Look up</button>
      </form>
      {error && <p className="mt-2 text-stamp">{error}</p>}

      {r && rank && (
        <article className="mt-10 sheet ruled max-w-2xl p-6 sm:p-10 relative">
          <p className="text-sm text-inksoft">Curriculum vitae</p>
          <h2 className="font-condensed text-5xl font-black mt-1 break-all">{shortAddr(r.address)}</h2>
          <p className="text-xl mt-1">{rank.title}</p>
          <div className="absolute top-6 right-6 text-xl stamp">Verified human</div>

          <dl className="mt-8 grid grid-cols-[10rem_1fr] gap-y-3">
            <dt className="text-inksoft">Employed for</dt>
            <dd>{r.daysHeld} days, never sold</dd>
            <dt className="text-inksoft">Assignments</dt>
            <dd>{r.tasks} completed</dd>
            <dt className="text-inksoft">Salary earned</dt>
            <dd>{r.earnedSol} SOL</dd>
            <dt className="text-inksoft">Holding</dt>
            <dd>{r.balance.toLocaleString("en-US")} {TOKEN_TICKER}</dd>
            <dt className="text-inksoft">Next promotion</dt>
            <dd>{rank.next ? `${rank.next.title}, in ${rank.next.min - r.tasks} tasks` : "None. This is the top."}</dd>
          </dl>

          <button className="btn btn-marker mt-8" onClick={() => setShare(true)}>
            Share on X
          </button>
          <p className="mt-6 text-xs text-inksoft">Preview build: resume numbers are sample data.</p>
        </article>
      )}
      {share && r && rank && (
        <ShareDialog
          card={{ kind: "resume", title: rank.title, tasks: r.tasks, days: r.daysHeld, earned: r.earnedSol, address: r.address }}
          onClose={() => setShare(false)}
        />
      )}
    </div>
  );
}

export default function ResumePage() {
  return (
    <Suspense>
      <ResumeInner />
    </Suspense>
  );
}
