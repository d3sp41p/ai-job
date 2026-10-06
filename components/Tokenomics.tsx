import {
  BASE_POINTS,
  COOLDOWN_MINUTES,
  HAS_COOLDOWN,
  MIN_CLAIM_SOL,
  MIN_HOLD,
  OVERTIME_RATE,
  PAID_SHIFTS_PER_DAY,
  PAYOUTS_PER_DAY,
  PAYROLL_MINUTES,
  QUALITY_THRESHOLD,
  SALARY_POOL_SHARE,
  TOKEN_TICKER,
  WALLET_HOURLY_CAP,
} from "@/lib/config";

const pct = (x: number) => `${Math.round(x * 100)}%`;

// The payroll rules in one block. Every number comes from lib/config.ts.
export default function Tokenomics({ title = "Payroll tokenomics" }: { title?: string }) {
  const flow = ["Every trade", "Creator fees", "Treasury", `${pct(SALARY_POOL_SHARE)} a day`, `${PAYOUTS_PER_DAY} rounds`, "Your wallet"];
  const tiles: [string, string, string][] = [
    ["Fees to workers", "100%", "The team takes 0. Every lamport of creator fees goes to the payroll."],
    ["Salary pool", `${pct(SALARY_POOL_SHARE)} / day`, "Always a share of the treasury, so it can never run dry."],
    ["Payday", `Every ${PAYROLL_MINUTES} min`, `${PAYOUTS_PER_DAY} payroll rounds a day, sent straight to your address.`],
    ["Shifts", HAS_COOLDOWN ? `Every ${COOLDOWN_MINUTES} min` : "Any time", `Easy ${BASE_POINTS.easy}, Medium ${BASE_POINTS.medium}, Hard ${BASE_POINTS.hard} base points.`],
    ["To get hired", `${(MIN_HOLD / 1000).toLocaleString("en-US")}K`, `${TOKEN_TICKER} on your address. Paid from the first minute you hold it.`],
    ["Fair share", `Max ${pct(WALLET_HOURLY_CAP)}`, "of one round per wallet. Whales can't take the whole payroll."],
    ["Full pay", `${PAID_SHIFTS_PER_DAY} shifts / day`, `Then overtime at ${pct(OVERTIME_RATE)}. Score ${pct(QUALITY_THRESHOLD)}+ to get paid.`],
    ["Payout from", `${MIN_CLAIM_SOL} SOL`, "Smaller amounts roll into the next round. No claiming, no fees for you."],
  ];

  return (
    <section className="sheet p-5 sm:p-7">
      <h2 className="font-condensed text-4xl sm:text-5xl font-black">{title}</h2>
      <ol className="mt-5 flex flex-wrap items-center gap-2 text-sm" aria-label="Where salaries come from">
        {flow.map((step, i) => (
          <li key={step} className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1.5 font-semibold ${i === flow.length - 1 ? "bg-marker text-paper" : "bg-raise"}`}>{step}</span>
            {i < flow.length - 1 && (
              <span className="text-inksoft" aria-hidden>
                →
              </span>
            )}
          </li>
        ))}
      </ol>
      <dl className="mt-6 grid gap-3 grid-cols-2 lg:grid-cols-4">
        {tiles.map(([k, v, note]) => (
          <div key={k} className="rounded-2xl border border-rule p-4">
            <dt className="text-sm text-inksoft">{k}</dt>
            <dd className="font-condensed text-3xl font-black mt-1 leading-none" translate="no">
              {v}
            </dd>
            <dd className="text-xs text-inksoft mt-2">{note}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-xs text-inksoft">
        Salaries depend on trading fees and on how many people work each round. Nothing here is guaranteed income.
      </p>
    </section>
  );
}
