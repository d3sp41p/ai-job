"use client";

import { useState } from "react";
import { shortAddr } from "@/lib/mock";
import { useEmployee } from "@/lib/wallet";
import ShareDialog from "./ShareDialog";

// Internal memo that lands on the desk when you get a new title.
export default function PromotionMemo({
  title,
  previous,
  address,
  tasks,
  onClose,
}: {
  title: string;
  previous: string;
  address: string;
  tasks: number;
  onClose: () => void;
}) {
  const [share, setShare] = useState(false);
  const emp = useEmployee();
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Promotion">
      <div className="memo-in sheet ruled w-full max-w-md p-7 relative">
        <p className="text-sm text-inksoft">Internal memo · {date}</p>
        <dl className="mt-4 grid grid-cols-[4.5rem_1fr] gap-y-1 text-[15px]">
          <dt className="text-inksoft">To</dt>
          <dd>{emp.name ? `${emp.name} (${shortAddr(address)})` : shortAddr(address)}</dd>
          <dt className="text-inksoft">From</dt>
          <dd>The AI, Department of Humans</dd>
          <dt className="text-inksoft">Re</dt>
          <dd>Change of title</dd>
        </dl>
        <p className="mt-6 text-inksoft">Effective immediately, you are no longer {previous}. You are now</p>
        <p className="font-condensed text-5xl font-black leading-[0.95] mt-1">{title}</p>
        <p className="mt-4 text-inksoft">
          Keep working. Your new title will appear on your resume and on the leaderboard.
        </p>
        <p className="mt-6 font-condensed text-2xl italic" style={{ fontVariationSettings: '"wdth" 100' }}>
          — The AI
        </p>
        <div className="absolute top-6 right-5 text-3xl stamp stamp-animate" style={{ animationDelay: "450ms" }}>
          Promoted
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button className="btn btn-primary" onClick={onClose}>
            Accept promotion
          </button>
          <button className="btn btn-marker" onClick={() => setShare(true)}>
            Share on X
          </button>
        </div>
        {share && (
          <ShareDialog
            card={{ kind: "promotion", title, previous: previous.replace(/^an? /, ""), tasks, address }}
            onClose={() => setShare(false)}
          />
        )}
      </div>
    </div>
  );
}
