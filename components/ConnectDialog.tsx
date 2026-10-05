"use client";

// "Enter wallet" dialog. The employee pastes a Solana address; nothing is connected or signed.
// Optional "Lock my address": one message signature so nobody else can work under this address.

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { cleanName, isSolanaAddress, useEmployee } from "@/lib/wallet";
import { MIN_HOLD, TOKEN_TICKER } from "@/lib/config";
import { shortAddr } from "@/lib/mock";
import { hasWallet, openInPhantom } from "@/lib/lockClient";

export default function ConnectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const emp = useEmployee();
  const [value, setValue] = useState("");
  const [name, setName] = useState("");
  const [editName, setEditName] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"enter" | "lock" | "locking">("enter");
  const [busy, setBusy] = useState(false);
  const [lockTarget, setLockTarget] = useState(""); // address to lock (may not be in the session yet)

  if (!open) return null;

  const close = () => {
    setEditName(null);
    setMode("enter");
    setError("");
    setLockTarget("");
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const a = value.trim();
    if (!isSolanaAddress(a)) {
      setError("That doesn't look like a Solana address. Paste the full address from your wallet app.");
      return;
    }
    setBusy(true);
    const r = await emp.setAddress(a, name);
    setBusy(false);
    if (!r.ok) {
      if (r.code === "locked_elsewhere") {
        setLockTarget(a);
        setMode("lock");
      }
      setError(r.error);
      return;
    }
    emp.say(cleanName(name) ? "Welcome aboard, {name}. I already know more about you than your last boss." : "Welcome aboard. No name? Fine. I'll call you human.");
    setValue("");
    setName("");
    close();
  };

  const doLock = async () => {
    const target = lockTarget || emp.address;
    if (!hasWallet()) {
      if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
        openInPhantom();
        return;
      }
      setError("No wallet app found. Install Phantom, Solflare or Backpack in this browser, then try again.");
      return;
    }
    setError("");
    setMode("locking");
    const r = await emp.lockAddress(target);
    if (!r.ok) {
      setMode("lock");
      setError(r.error);
      return;
    }
    emp.say("Signature received. This address now answers only to you, {name}.");
    close();
  };

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setValue(t.trim());
    } catch {
      setError("Your browser blocked pasting. Long-press the field and choose Paste.");
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Your wallet address"
    >
      <div className="sheet w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        {emp.address && mode === "enter" ? (
          <>
            <h2 className="font-condensed text-3xl font-black">Your payroll address</h2>
            <p className="mt-2 font-mono text-sm break-all text-inksoft">{emp.address}</p>
            <form
              className="mt-4 grid gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const r = await emp.setName(editName ?? emp.name);
                if (!r.ok) {
                  setError(r.error);
                  return;
                }
                setEditName(null);
                setError("");
                emp.say("Noted, {name}. Your file has been updated.");
              }}
            >
              <label htmlFor="edit-name" className="text-sm text-inksoft">What the AI calls you</label>
              <div className="flex gap-2">
                <input
                  id="edit-name"
                  value={editName ?? emp.name}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="human"
                  maxLength={20}
                  className="flex-1 min-w-0 border border-rule rounded-full bg-paper px-4 py-2.5 text-sm"
                />
                <button className="btn btn-plain !py-2 text-sm">Save</button>
              </div>
            </form>
            {error && <p className="mt-2 text-sm text-stamp">{error}</p>}
            <div className="mt-4 rounded-2xl bg-raise p-4">
              <p className="font-semibold">{emp.locked ? "Locked to this device" : "Not locked"}</p>
              <p className="mt-1 text-sm text-inksoft">
                {emp.locked
                  ? "Only you can take assignments for this address."
                  : "Anyone who pastes your address can work for it. They can't take your money, but they could use up your shifts."}
              </p>
              {!emp.locked && (
                <button className="btn btn-plain mt-3 !py-2 text-sm" onClick={() => { setError(""); setMode("lock"); }}>
                  Lock my address
                </button>
              )}
            </div>
            <div className="mt-5 flex gap-2">
              <button className="btn btn-primary flex-1" onClick={close}>
                Done
              </button>
              <button
                className="btn btn-plain"
                onClick={() => {
                  emp.forgetAddress();
                  close();
                }}
              >
                Use another address
              </button>
            </div>
          </>
        ) : mode === "lock" || mode === "locking" ? (
          <>
            <h2 className="font-condensed text-3xl font-black">Lock {shortAddr(lockTarget || emp.address)}</h2>
            <p className="mt-2 text-inksoft">
              {lockTarget
                ? "This address is locked to another device. If it's yours, sign a short message with the wallet that holds it to work from here too."
                : "Your wallet app will ask you to sign a short message once. After that, only your signed devices can work under your address."}
            </p>
            <p className="mt-3 rounded-2xl bg-ok/10 text-ok p-3 text-sm">
              Signing a message is free and does not give access to your funds. It is not a transaction.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                className="btn btn-primary flex-1"
                disabled={mode === "locking"}
                onClick={doLock}
              >
                {mode === "locking" ? "Waiting for your wallet…" : "Sign and lock"}
              </button>
              <button className="btn btn-plain" onClick={() => { setError(""); setLockTarget(""); setMode("enter"); }}>
                Back
              </button>
            </div>
            {error && <p className="mt-3 text-sm text-stamp">{error}</p>}
          </>
        ) : (
          <>
            <h2 className="font-condensed text-3xl font-black">Get on payroll</h2>
            <p className="mt-2 text-inksoft">
              Paste the Solana address that holds your {TOKEN_TICKER}. We only read it. Nothing to connect, nothing to
              sign. Salaries are sent to this address automatically.
            </p>
            <form onSubmit={submit} className="mt-5 grid gap-2">
              <label htmlFor="payroll-address" className="text-sm text-inksoft">
                Wallet address
              </label>
              <div className="flex gap-2">
                <input
                  id="payroll-address"
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    setError("");
                  }}
                  placeholder="e.g. 7xKX…gAsU"
                  className="flex-1 min-w-0 border border-rule rounded-full bg-paper px-4 py-3 font-mono text-sm"
                  spellCheck={false}
                  autoComplete="off"
                />
                <button type="button" className="btn btn-plain !px-4" onClick={paste}>
                  Paste
                </button>
              </div>
              {error && <p className="text-sm text-stamp">{error}</p>}
              <div className="mt-2 grid gap-2">
              <label htmlFor="payroll-name" className="text-sm text-inksoft">
                What should the AI call you? <span className="text-inksoft/70">(optional)</span>
              </label>
              <input
                id="payroll-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Cupsey"
                maxLength={20}
                className="border border-rule rounded-full bg-paper px-4 py-3 text-sm"
                autoComplete="nickname"
              />
              </div>
              <button className="btn btn-marker mt-2" disabled={busy}>{busy ? "Checking your file…" : "Start working"}</button>
            </form>
            <ul className="mt-5 grid gap-1.5 text-sm text-inksoft">
              <li>You need at least {MIN_HOLD.toLocaleString("en-US")} {TOKEN_TICKER} on this address to get paid.</li>
              <li>
                No wallet yet? You can still try a shift as a guest.{" "}
                <Link href="/how-it-works/#safety" className="underline underline-offset-4" onClick={close}>
                  Why this is safe
                </Link>
              </li>
            </ul>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
