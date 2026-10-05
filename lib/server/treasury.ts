// Treasury = free SOL on TREASURY + PAYOUT, minus salaries already owed to workers. Server only.

import { salaryPool, hourlyPayroll } from "@/lib/config";
import { getSolBalance, isValidAddress, ChainError } from "./solana";
import { select } from "./db";

export async function owedSol() {
  const rows: any[] = await select("balances", { columns: "accrued_sol,paid_sol", limit: 100000 });
  return rows.reduce((s: number, r: any) => s + Math.max(0, Number(r.accrued_sol) - Number(r.paid_sol)), 0);
}

export async function readTreasury() {
  const treasuryAddr = (process.env.NEXT_PUBLIC_TREASURY_ADDRESS || "").trim();
  const payoutAddr = (process.env.NEXT_PUBLIC_PAYOUT_ADDRESS || "").trim();
  if (!treasuryAddr || !payoutAddr) throw new ChainError("Company wallets aren't configured yet.", "not_configured");
  const bad = [
    !isValidAddress(treasuryAddr) && "NEXT_PUBLIC_TREASURY_ADDRESS",
    !isValidAddress(payoutAddr) && "NEXT_PUBLIC_PAYOUT_ADDRESS",
  ].filter(Boolean);
  if (bad.length) throw new ChainError(`Not a valid Solana address: ${bad.join(", ")}`, "bad_address");

  const [t, p, owed] = await Promise.all([getSolBalance(treasuryAddr), getSolBalance(payoutAddr), owedSol()]);
  const treasury = Math.max(0, t + p - owed);
  return {
    treasuryWalletSol: t,
    payoutWalletSol: p,
    owedSol: owed,
    treasurySol: treasury,
    salaryPoolSol: salaryPool(treasury),
    thisHourSol: hourlyPayroll(treasury),
    payoutWalletShort: p < owed, // admin warning: top up PAYOUT
  };
}
