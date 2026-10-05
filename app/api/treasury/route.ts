import { getSolBalance, ChainError, network, isValidAddress } from "@/lib/server/solana";
import { select } from "@/lib/server/db";
import { salaryPool, hourlyPayroll } from "@/lib/config";

export const dynamic = "force-dynamic";

// Public: live treasury numbers. Treasury = TREASURY + PAYOUT balances minus salaries owed.
export async function GET() {
  const treasuryAddr = (process.env.NEXT_PUBLIC_TREASURY_ADDRESS || "").trim();
  const payoutAddr = (process.env.NEXT_PUBLIC_PAYOUT_ADDRESS || "").trim();
  if (!treasuryAddr || !payoutAddr) {
    return Response.json({ error: "Company wallets aren't configured yet." }, { status: 503 });
  }
  const bad = [
    !isValidAddress(treasuryAddr) && "NEXT_PUBLIC_TREASURY_ADDRESS",
    !isValidAddress(payoutAddr) && "NEXT_PUBLIC_PAYOUT_ADDRESS",
  ].filter(Boolean);
  if (bad.length) {
    return Response.json({ error: `Not a valid Solana address: ${bad.join(", ")}`, code: "bad_address" }, { status: 503 });
  }
  try {
    const [t, p] = await Promise.all([getSolBalance(treasuryAddr), getSolBalance(payoutAddr)]);
    const rows: any[] = await select("balances", { columns: "accrued_sol,paid_sol" }).catch(() => []);
    const owed = rows.reduce((s: number, r: any) => s + Math.max(0, Number(r.accrued_sol) - Number(r.paid_sol)), 0);
    const treasury = Math.max(0, t + p - owed);
    return Response.json(
      {
        network: network(),
        treasuryWalletSol: t,
        payoutWalletSol: p,
        owedSol: owed,
        treasurySol: treasury,
        salaryPoolSol: salaryPool(treasury),
        thisHourSol: hourlyPayroll(treasury),
        payoutWalletShort: p < owed, // admin warning: top up PAYOUT
      },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch (e) {
    const code = e instanceof ChainError ? e.code : "unknown";
    // the RPC message never contains our key, safe to show
    const detail = String((e as Error)?.message || "").slice(0, 200);
    return Response.json({ error: "Couldn't read the treasury right now.", code, detail, network: network() }, { status: 503 });
  }
}
