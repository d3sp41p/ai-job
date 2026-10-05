"use client";

import { useCallback, useEffect, useState } from "react";
import { shortAddr } from "@/lib/mock";
import { fmtSol } from "@/lib/format";
import { timeAgo, useNow } from "@/components/useNow";

type Overview = {
  treasury: any;
  paused: boolean;
  limits: { maxPayoutSol: number; dailyCapSol: number };
  paidTodaySol: number;
  hours: any[];
  payouts: any[];
  flagged: any[];
  banned: any[];
  owed: { wallet: string; owedSol: number }[];
  log: any[];
};

const solscan = (path: string) => `https://solscan.io/${path}`;
const Addr = ({ a }: { a: string }) => (
  <a href={solscan(`account/${a}`)} target="_blank" rel="noreferrer" className="font-mono underline underline-offset-4">
    {shortAddr(a)}
  </a>
);

export default function AdminPage() {
  const now = useNow(30_000);
  const [data, setData] = useState<Overview | null>(null);
  const [state, setState] = useState<"loading" | "login" | "ready">("loading");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [banAddr, setBanAddr] = useState("");
  const [lastRun, setLastRun] = useState<any>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/overview", { cache: "no-store" });
    if (r.status === 401) return setState("login");
    if (!r.ok) return setError("Couldn't load the overview.");
    setData(await r.json());
    setState("ready");
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setError(d.error || "Wrong password.");
    setPassword("");
    load();
  };

  const act = async (action: string, extra: object = {}, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(action);
    setError("");
    const r = await fetch("/api/admin/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
    const d = await r.json().catch(() => ({}));
    setBusy("");
    if (!r.ok) return setError(d.error || "That didn't work.");
    if (action === "run_now") setLastRun(d);
    if (action === "ban" || action === "unban") setBanAddr("");
    load();
  };

  if (state === "loading") return <p className="mx-auto max-w-6xl px-4 py-10 text-inksoft">Loading…</p>;

  if (state === "login")
    return (
      <form onSubmit={login} className="mx-auto max-w-sm px-4 py-16 grid gap-3">
        <h1 className="font-condensed text-5xl font-black">Admin</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Admin password"
          autoComplete="current-password"
          className="border border-rule rounded-full bg-paper px-4 py-3"
        />
        <button className="btn btn-marker">Sign in</button>
        {error && <p className="text-sm text-stamp">{error}</p>}
      </form>
    );

  const d = data!;
  const t = d.treasury;
  const tErr = t?.error as string | undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-condensed text-5xl font-black">Admin</h1>
        <button
          className="text-sm underline underline-offset-4"
          onClick={async () => {
            await fetch("/api/admin/login", { method: "DELETE" });
            setState("login");
          }}
        >
          Sign out
        </button>
      </div>
      {error && <p className="rounded-2xl bg-stamp/15 text-stamp px-5 py-3">{error}</p>}

      {/* kill switch */}
      <section className={`p-5 sm:p-6 rounded-[20px] border-2 ${d.paused ? "border-stamp bg-stamp/10" : "border-ok bg-ok/10"}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-inksoft">Automatic payouts</p>
            <p className={`font-condensed text-4xl font-black ${d.paused ? "text-stamp" : "text-ok"}`}>{d.paused ? "PAUSED" : "RUNNING"}</p>
            <p className="text-sm text-inksoft mt-1">
              Salaries are still counted every hour while paused. They are sent when you resume.
            </p>
          </div>
          {d.paused ? (
            <button className="btn btn-marker" disabled={!!busy} onClick={() => act("resume", {}, "Resume automatic payouts?")}>
              Resume payouts
            </button>
          ) : (
            <button className="btn btn-primary !bg-stamp !text-paper" disabled={!!busy} onClick={() => act("pause")}>
              Pause all payouts
            </button>
          )}
        </div>
      </section>

      {/* money */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tErr ? (
          <div className="sheet p-5 sm:col-span-2 lg:col-span-4 text-stamp">Couldn&rsquo;t read the wallets: {tErr}</div>
        ) : (
          <>
            <Stat k="Treasury (free)" v={`${fmtSol(t.treasurySol)} SOL`} note="Both wallets minus salaries owed" />
            <Stat k="Pay wallet balance" v={`${fmtSol(t.payoutWalletSol)} SOL`} note={`Owed to workers: ${fmtSol(t.owedSol)} SOL`} warn={t.payoutWalletShort} />
            <Stat k="Treasury wallet" v={`${fmtSol(t.treasuryWalletSol)} SOL`} note="Claim pump.fun fees here" />
            <Stat
              k="Sent in last 24 h"
              v={`${fmtSol(d.paidTodaySol)} SOL`}
              note={`Daily cap ${d.limits.dailyCapSol} SOL · max ${d.limits.maxPayoutSol} SOL per address`}
              warn={d.paidTodaySol >= d.limits.dailyCapSol}
            />
          </>
        )}
      </section>
      {!tErr && t.payoutWalletShort && (
        <p className="rounded-2xl bg-stamp/15 text-stamp px-5 py-3 font-semibold">
          Top up the pay wallet: it holds less than what is owed to workers. Payouts wait until it has enough.
        </p>
      )}

      <section className="sheet p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Run the hourly job now</p>
          <p className="text-sm text-inksoft">Settles finished hours and sends salaries that are due. Safe to press twice.</p>
        </div>
        <button className="btn btn-plain" disabled={!!busy} onClick={() => act("run_now")}>
          {busy === "run_now" ? "Running…" : "Run now"}
        </button>
        {lastRun && <pre className="w-full overflow-x-auto text-xs bg-paper rounded-xl p-3">{JSON.stringify(lastRun, null, 2)}</pre>}
      </section>

      <Table
        title="Payouts that need attention"
        empty="Nothing stuck. Pending payouts are checked against the chain every hour."
        head={["When", "To", "Amount", "Status", "Transaction"]}
        rows={d.payouts.map((p) => [
          timeAgo(Date.parse(p.created_at), now),
          <Addr key="a" a={p.wallet} />,
          `${fmtSol(Number(p.amount_sol))} SOL`,
          <span key="s" className={p.status === "failed" ? "text-stamp" : "text-marker"} title={p.error || ""}>
            {p.status}
            {p.error ? ` · ${String(p.error).slice(0, 40)}` : ""}
          </span>,
          p.tx_signature ? (
            <a key="t" href={solscan(`tx/${p.tx_signature}`)} target="_blank" rel="noreferrer" className="underline underline-offset-4">
              Solscan
            </a>
          ) : (
            "—"
          ),
        ])}
      />

      <Table
        title="Hourly payroll (last 24 hours)"
        empty="No hour has been settled yet. The scheduler runs at :02 every hour."
        head={["Hour (UTC)", "Treasury", "Slice", "Workers", "Points", "Sent to balances"]}
        rows={d.hours.map((h) => [
          String(h.hour_start).slice(5, 16).replace("T", " "),
          `${fmtSol(Number(h.treasury_sol))}`,
          Number(h.slice_sol).toFixed(5),
          h.workers,
          Number(h.total_points),
          Number(h.distributed_sol).toFixed(5),
        ])}
      />

      <Table
        title="Owed to workers"
        empty="Nobody is owed anything right now."
        head={["Address", "Owed"]}
        rows={d.owed.map((o) => [<Addr key="a" a={o.wallet} />, `${o.owedSol.toFixed(5)} SOL`])}
      />

      <Table
        title="Suspicious shifts"
        empty="No suspicious shifts."
        head={["When", "Address", "Job", "Score", "Reason"]}
        rows={d.flagged.map((f) => [
          timeAgo(Date.parse(f.started_at), now),
          f.wallet ? <Addr key="a" a={f.wallet} /> : "guest",
          f.game_id,
          `${Math.round(Number(f.performance || 0) * 100)}%`,
          f.flagged,
        ])}
      />

      <section className="sheet p-5 grid gap-3">
        <h2 className="font-condensed text-3xl font-black">Ban an address</h2>
        <p className="text-sm text-inksoft">A banned address can&rsquo;t start shifts, gets nothing in the hourly payroll and receives no payouts.</p>
        <div className="flex flex-wrap gap-2">
          <input
            value={banAddr}
            onChange={(e) => setBanAddr(e.target.value)}
            placeholder="Solana address"
            className="flex-1 min-w-0 border border-rule rounded-full bg-paper px-4 py-3 font-mono text-sm"
            spellCheck={false}
          />
          <button className="btn btn-primary !bg-stamp !text-paper" disabled={!banAddr || !!busy} onClick={() => act("ban", { address: banAddr }, `Ban ${banAddr}?`)}>
            Ban
          </button>
        </div>
        {d.banned.length > 0 && (
          <ul className="grid gap-1">
            {d.banned.map((b) => (
              <li key={b.address} className="flex items-center justify-between gap-3 border-t border-rule pt-2">
                <span>
                  <Addr a={b.address} /> {b.display_name ? `· ${b.display_name}` : ""} · {b.tasks_completed} tasks
                </span>
                <button className="text-sm underline underline-offset-4" disabled={!!busy} onClick={() => act("unban", { address: b.address })}>
                  Unban
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Table
        title="Admin log"
        empty="Nothing yet."
        head={["When", "Who", "Action", "Details"]}
        rows={d.log.map((l) => [timeAgo(Date.parse(l.at), now), l.actor, l.action, l.details ? JSON.stringify(l.details).slice(0, 80) : ""])}
      />
    </div>
  );
}

function Stat({ k, v, note, warn }: { k: string; v: string; note?: string; warn?: boolean }) {
  return (
    <div className={`sheet p-5 ${warn ? "!border-stamp" : ""}`}>
      <p className="text-sm text-inksoft">{k}</p>
      <p className={`font-condensed text-3xl font-black mt-1 ${warn ? "text-stamp" : ""}`} translate="no">
        {v}
      </p>
      {note && <p className="text-xs text-inksoft mt-1">{note}</p>}
    </div>
  );
}

function Table({ title, head, rows, empty }: { title: string; head: string[]; rows: React.ReactNode[][]; empty: string }) {
  return (
    <section className="sheet">
      <h2 className="px-5 pt-5 font-condensed text-3xl font-black">{title}</h2>
      {rows.length === 0 ? (
        <p className="px-5 pt-2 pb-5 text-inksoft">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="mt-3 w-full text-left text-[14px]">
            <thead className="text-sm text-inksoft border-b border-rule">
              <tr>
                {head.map((h) => (
                  <th key={h} className="font-normal px-5 py-2 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-rule last:border-0">
                  {r.map((c, j) => (
                    <td key={j} className="px-5 py-2.5 whitespace-nowrap">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
