"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useEmployee } from "@/lib/wallet";
import { shortAddr } from "@/lib/mock";
import { TOKEN_TICKER } from "@/lib/config";
import ConnectDialog from "./ConnectDialog";

const NAV = [
  { href: "/how-it-works/", label: "How it works" },
  { href: "/office/", label: "Office" },
  { href: "/dashboard/", label: "Payroll" },
  { href: "/resume/", label: "Resumes" },
];

export default function Header() {
  const path = usePathname();
  const emp = useEmployee();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper/75 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center gap-4">
        <Link href="/" className="flex items-baseline gap-2 shrink-0">
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-marker shadow-[0_0_12px_rgba(241,224,90,0.8)]" aria-hidden /><span className="font-condensed text-xl font-extrabold leading-none">AI Gave Me a Job</span></span>
          <span className="hidden sm:inline text-sm text-inksoft font-mono">{TOKEN_TICKER}</span>
        </Link>

        <nav className="ml-auto hidden md:flex items-center gap-1">
          {NAV.map((n) => {
            const active = path?.startsWith(n.href.replace(/\/$/, ""));
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`px-3.5 py-1.5 rounded-full text-[15px] font-medium transition-colors ${active ? "bg-ink text-paper" : "text-inksoft hover:text-ink hover:bg-raise"}`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto md:ml-3">
          {emp.address ? (
            <button className="btn btn-plain !py-2 !px-3 text-sm font-mono" onClick={() => setOpen(true)} title="Your payroll address">
              <span className="inline-block h-2 w-2 rounded-full bg-ok" aria-hidden />
              {shortAddr(emp.address)}
              {emp.locked && <span className="text-inksoft font-sans">locked</span>}
            </button>
          ) : (
            <button className="btn btn-primary !py-2 !px-3 text-sm" onClick={() => setOpen(true)}>
              Enter wallet
            </button>
          )}
        </div>
      </div>

      <nav className="md:hidden border-t border-rule flex">
        {NAV.map((n) => {
          const active = path?.startsWith(n.href.replace(/\/$/, ""));
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex-1 text-center py-2.5 text-[13px] font-medium whitespace-nowrap ${active ? "bg-ink text-paper" : ""}`}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>

      <ConnectDialog open={open} onClose={() => setOpen(false)} />
    </header>
  );
}
