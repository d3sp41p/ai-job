import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TOKEN_TICKER } from "@/lib/config";
import { cardHeadline, cardWho, getCard } from "@/lib/server/share";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

// The image itself comes from ./opengraph-image.tsx and ./twitter-image.tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const card = await getCard((await params).id);
  if (!card) return { title: "AI Gave Me a Job" };
  const title = `${cardWho(card)}: ${cardHeadline(card)}`;
  const description = "AI took your job. Now it's hiring. Hold the coin, take assignments, get paid in SOL.";
  return { title, description, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } };
}

export default async function SharedCard({ params }: Props) {
  const card = await getCard((await params).id);
  if (!card) notFound();
  const rows: [string, string][] =
    card.kind === "salary"
      ? [["Title", card.title], ["Assignments", String(card.tasks)], ["On payroll", `${card.days} days`]]
      : card.kind === "promotion"
        ? [["Previous title", card.previous ?? ""], ["Assignments", String(card.tasks)]]
        : [["On payroll", `${card.days} days`], ["Assignments", String(card.tasks)], ["Earned", `${card.earned ?? 0} SOL`]];

  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 py-12">
      <div className="sheet p-6 sm:p-8">
        <p className="text-inksoft">{card.kind === "salary" ? "Payslip" : card.kind === "promotion" ? "Promotion memo" : "Employee file"}</p>
        <p className="mt-1 text-lg">{cardWho(card)}</p>
        <h1 className="font-condensed text-5xl font-black mt-2 leading-none">{cardHeadline(card)}</h1>
        <dl className="mt-6 grid grid-cols-[1fr_auto] gap-y-2 border-t border-rule pt-4 text-[15px]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-inksoft">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        {card.kind === "salary" && card.tx && (
          <a href={`https://solscan.io/tx/${card.tx}`} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm underline underline-offset-4">
            See the transaction on Solscan
          </a>
        )}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/office/" className="btn btn-marker">
          Get a job too
        </Link>
        <Link href={`/resume/?address=${card.address}`} className="btn btn-plain">
          View the full resume
        </Link>
      </div>
      <p className="mt-6 text-sm text-inksoft">
        AI took your job. Now it&rsquo;s hiring. Hold {TOKEN_TICKER}, take assignments, get paid in SOL from 100% of the coin&rsquo;s fees.
      </p>
    </div>
  );
}
