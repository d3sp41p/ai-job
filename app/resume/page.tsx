"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { rankFor, TOKEN_TICKER, MIN_HOLD } from "@/lib/config";
import { shortAddr } from "@/lib/mock";
import ShareDialog from "@/components/ShareDialog";

const isSolanaAddress = (a: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
const fmt = (n: number) => Math.floor(n).toLocaleString("en-US");

type Resume = {
  address: string;
  name: string | null;
  balance: number;
  minBalance24h: number;
  holdStart: string | null;
  daysHeld: number;
  holdMultiplier: number;
  streakMultiplier: number;
  eligible: boolean;
  tasksCompleted: number;
  earnedSol: number;
  checkedAt: string;
};

function ResumeInner() {
  const params = useSearchParams();
  const router = useRouter();
  const address = params.get("address") ?? "";
  const [input, setInput] = useState(address);
  const [error, setError] = useState("");
  const [share, setShare] = useState(false);

  useEffect(() => setInput(address), [address]);

  const [r, setR] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setR(null);
    if (!address || !isSolanaAddress(address)) return;
    let alive = true;
    setLoading(true);
    setError("");
    fetch(`/api/wallet/${address}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) setError(body.error || "Couldn't load this resume. Try again.");
        else setR(body as Resume);
      })
      .catch(() => alive && setError("Couldn't reach the server. Try again."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [address]);

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

  const rank = r ? rankFor(r.tasksCompleted) : null;


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
      {loading && <p className="mt-6 text-inksoft">Pulling the personnel file from the chain…</p>}

      {r && rank && (
        <article className="mt-10 sheet ruled max-w-2xl p-6 sm:p-10 relative">
          <p className="text-sm text-inksoft">Curriculum vitae</p>
          <h2 className="font-condensed text-5xl font-black mt-1 break-all" translate="no">{r.name || shortAddr(r.address)}</h2>
          <p className="text-xl mt-1">{rank.title}</p>
          <div className="absolute top-6 right-6 text-xl stamp">{r.eligible ? "Verified human" : "Trainee"}</div>

          <dl className="mt-8 grid grid-cols-[10rem_1fr] gap-y-3">
            <dt className="text-inksoft">Employed for</dt>
            <dd translate="no">{r.holdStart ? `${r.daysHeld} days, never dipped below the minimum` : "Not employed. Holds less than the minimum."}</dd>
            <dt className="text-inksoft">Holding</dt>
            <dd translate="no">{fmt(r.balance)} {TOKEN_TICKER}</dd>
            <dt className="text-inksoft">Lowest in 24h</dt>
            <dd translate="no">{fmt(r.minBalance24h)} {TOKEN_TICKER}</dd>
            <dt className="text-inksoft">Holding bonus</dt>
            <dd translate="no">{r.holdMultiplier > 0 ? `x${r.holdMultiplier.toFixed(1)}` : `none (needs ${fmt(MIN_HOLD)} for a full day)`}</dd>
            <dt className="text-inksoft">Loyalty bonus</dt>
            <dd translate="no">x{r.streakMultiplier.toFixed(2)}</dd>
            <dt className="text-inksoft">Assignments</dt>
            <dd translate="no">{r.tasksCompleted} completed</dd>
            <dt className="text-inksoft">Salary earned</dt>
            <dd translate="no">{r.earnedSol.toFixed(3)} SOL</dd>
            <dt className="text-inksoft">Next promotion</dt>
            <dd>{rank.next ? `${rank.next.title}, in ${rank.next.min - r.tasksCompleted} tasks` : "None. This is the top."}</dd>
          </dl>

          <button className="btn btn-marker mt-8" onClick={() => setShare(true)}>
            Share on X
          </button>
          {!r.eligible && (
            <p className="mt-6 text-sm text-inksoft">
              Shifts from this address count as training until it holds {fmt(MIN_HOLD)} {TOKEN_TICKER} for a full day.
            </p>
          )}
          <p className="mt-6 text-xs text-inksoft" translate="no">Read from the chain {new Date(r.checkedAt).toLocaleTimeString()}.</p>
        </article>
      )}
      {share && r && rank && (
        <ShareDialog
          card={{ kind: "resume", title: rank.title, tasks: r.tasksCompleted, days: r.daysHeld, earned: r.earnedSol, address: r.address }}
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
