// Automatic payouts from the PAYOUT wallet. Server only. Runs right after the hourly payroll.
//
// Safety rules (CLAUDE.md, "Автоматические выплаты"):
// - the payout row (status pending + signature) is saved BEFORE the transaction is sent;
// - a pending payout is never re-sent: it becomes "failed" only when its blockhash has expired
//   and the signature is nowhere on chain, and only then the amount is free to be paid again;
// - while anything is still pending, no new payouts are made;
// - limits per address (MAX_PAYOUT_SOL) and per day (DAILY_PAYOUT_CAP_SOL), emergency pause in admin_settings.

import { randomUUID } from "node:crypto";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  SendTransactionError,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { DAILY_PAYOUT_CAP_SOL, MAX_PAYOUT_SOL, MIN_CLAIM_SOL, PAYOUTS_PER_TX } from "@/lib/config";
import { insert, rpc, select } from "./db";
import { decodeBase58, rpcUrl } from "./solana";

if (typeof window !== "undefined") {
  throw new Error("lib/server/payouts.ts must never run in the browser");
}

const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const FEE_RESERVE_LAMPORTS = 1_000_000; // 0.001 SOL kept for network fees
const CONFIRM_WAIT_MS = 35_000;
const RESEND_EVERY_MS = 2_000;
// priority fee so a busy network doesn't drop the transaction: price × units ≈ 0.00001 SOL per batch
const PRIORITY_MICROLAMPORTS = Number(process.env.PAYOUT_PRIORITY_MICROLAMPORTS) || 200_000;
const COMPUTE_UNITS = 50_000;

export class PayoutError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function encodeBase58(bytes: Uint8Array) {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let s = "";
  while (n > 0n) {
    s = ALPHABET[Number(n % 58n)] + s;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    s = "1" + s;
  }
  return s;
}

/** The PAYOUT wallet's key from env. Accepts Phantom's base58 export or a JSON byte array. Never logged. */
function payoutKeypair(): Keypair {
  const raw = (process.env.PAYOUT_WALLET_SECRET_KEY || "").trim();
  if (!raw) throw new PayoutError("PAYOUT_WALLET_SECRET_KEY is not set", "not_configured");
  let bytes: Uint8Array;
  try {
    bytes = raw.startsWith("[") ? Uint8Array.from(JSON.parse(raw)) : new Uint8Array(decodeBase58(raw));
  } catch {
    throw new PayoutError("PAYOUT_WALLET_SECRET_KEY can't be read", "bad_key");
  }
  if (bytes.length !== 64) throw new PayoutError("PAYOUT_WALLET_SECRET_KEY has the wrong length", "bad_key");
  const kp = Keypair.fromSecretKey(bytes);
  const expected = (process.env.NEXT_PUBLIC_PAYOUT_ADDRESS || "").trim();
  if (kp.publicKey.toBase58() !== expected) {
    throw new PayoutError("PAYOUT_WALLET_SECRET_KEY doesn't belong to NEXT_PUBLIC_PAYOUT_ADDRESS", "key_mismatch");
  }
  return kp;
}

export async function payoutsPaused() {
  const [row] = await select("admin_settings", { columns: "value", filters: { key: "eq.payouts_paused" }, limit: 1 });
  return row?.value !== false; // missing setting = paused
}

/** Settle earlier payouts: confirmed -> paid, expired and not on chain -> failed. */
async function reconcile(conn: Connection) {
  const pending = await select("payouts", {
    columns: "id,tx_signature,last_valid_height",
    filters: { status: "eq.pending" },
    limit: 500,
  });
  if (!pending.length) return { paid: 0, failed: 0, stillPending: 0 };

  const sigs = [...new Set(pending.map((p: any) => p.tx_signature as string).filter(Boolean))];
  const [st, height] = await Promise.all([
    sigs.length ? conn.getSignatureStatuses(sigs, { searchTransactionHistory: true }) : Promise.resolve({ value: [] as any[] }),
    conn.getBlockHeight("confirmed"),
  ]);
  const status = new Map(sigs.map((s, i) => [s, st.value[i]]));

  const paid: string[] = [];
  const failed: { id: string; error: string }[] = [];
  for (const p of pending) {
    const s = p.tx_signature ? status.get(p.tx_signature) : null;
    if (s && !s.err && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) paid.push(p.id);
    else if (s?.err) failed.push({ id: p.id, error: `on-chain error: ${JSON.stringify(s.err)}` });
    else if (!s && p.last_valid_height && height > Number(p.last_valid_height)) failed.push({ id: p.id, error: "blockhash expired, not on chain" });
  }
  if (paid.length) await rpc("mark_payouts_paid", { p_ids: paid });
  for (const f of failed) await rpc("mark_payouts_failed", { p_ids: [f.id], p_error: f.error });
  return { paid: paid.length, failed: failed.length, stillPending: pending.length - paid.length - failed.length };
}

type Due = { wallet: string; lamports: number };

/** Who gets paid now, within the per-address, daily and wallet-balance limits */
async function duePayouts(balanceLamports: number) {
  const [rows, recent] = await Promise.all([
    select("balances", { columns: "wallet,accrued_sol,paid_sol,wallets(banned)", limit: 100000 }),
    select("payouts", {
      columns: "amount_sol",
      filters: { status: "in.(pending,paid)", created_at: `gte.${new Date(Date.now() - 24 * 3600_000).toISOString()}` },
      limit: 100000,
    }),
  ]);
  const usedToday = recent.reduce((s: number, r: any) => s + Number(r.amount_sol), 0);
  let dayRoom = Math.floor(Math.max(0, DAILY_PAYOUT_CAP_SOL - usedToday) * 1e9);
  let walletRoom = Math.max(0, balanceLamports - FEE_RESERVE_LAMPORTS);

  const candidates = rows
    .filter((r: any) => !r.wallets?.banned)
    .map((r: any) => ({ wallet: r.wallet as string, due: Number(r.accrued_sol) - Number(r.paid_sol) }))
    .filter((r) => r.due >= MIN_CLAIM_SOL)
    .sort((a, b) => b.due - a.due);

  const out: Due[] = [];
  let short = false;
  let capped = false;
  for (const c of candidates) {
    const lamports = Math.floor(Math.min(c.due, MAX_PAYOUT_SOL) * 1e9);
    if (lamports > dayRoom) {
      capped = true;
      continue;
    }
    if (lamports + 5_000 > walletRoom) {
      short = true;
      continue;
    }
    out.push({ wallet: c.wallet, lamports });
    dayRoom -= lamports;
    walletRoom -= lamports + 5_000;
  }
  return { due: out, waiting: candidates.length, payoutWalletShort: short, dailyCapReached: capped };
}

async function sendBatch(conn: Connection, kp: Keypair, batch: Due[]) {
  const batchId = randomUUID();
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: kp.publicKey, blockhash, lastValidBlockHeight });
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNITS }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_MICROLAMPORTS }));
  for (const p of batch) {
    tx.add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: new PublicKey(p.wallet), lamports: p.lamports }));
  }
  tx.add(new TransactionInstruction({ keys: [], programId: MEMO_PROGRAM, data: Buffer.from(`hiredby.fun payroll ${batchId}`) }));
  tx.sign(kp);
  const signature = encodeBase58(tx.signature!);

  // 1) record first: if we crash after sending, the next run finds this signature and reconciles it
  let rows: any[];
  try {
    rows = await insert(
      "payouts",
      batch.map((p) => ({
        wallet: p.wallet,
        amount_sol: (p.lamports / 1e9).toFixed(9),
        lamports: p.lamports,
        status: "pending",
        batch_id: batchId,
        tx_signature: signature,
        last_valid_height: lastValidBlockHeight,
      }))
    );
  } catch {
    return { signature: null, sent: 0, error: "couldn't record the batch, nothing sent" };
  }
  const ids = rows.map((r) => r.id as string);

  // 2) send
  const raw = tx.serialize();
  try {
    await conn.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 5 });
  } catch (e) {
    // a failed simulation means the network refused it: nothing moved, safe to free the amount
    if (e instanceof SendTransactionError) {
      await rpc("mark_payouts_failed", { p_ids: ids, p_error: `rejected before sending: ${String(e.message).slice(0, 200)}` });
      return { signature, sent: 0, error: "rejected by the network" };
    }
    // anything else (timeout, connection): it may have gone through. Leave pending, reconcile later.
    return { signature, sent: 0, error: "unclear, will be checked next hour" };
  }

  // 3) wait for confirmation, re-broadcasting the SAME signed transaction meanwhile.
  //    Same signature = the network can include it at most once, so this never pays twice.
  //    If it's still unclear when we stop waiting, the next run reconciles it.
  const until = Date.now() + CONFIRM_WAIT_MS;
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, RESEND_EVERY_MS));
    const st = (await conn.getSignatureStatuses([signature]).catch(() => null))?.value[0];
    if (st?.err) {
      await rpc("mark_payouts_failed", { p_ids: ids, p_error: `on-chain error: ${JSON.stringify(st.err)}` });
      return { signature, sent: 0, error: "failed on chain, amounts are free again" };
    }
    if (st && (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized")) {
      await rpc("mark_payouts_paid", { p_ids: ids });
      return { signature, sent: batch.length, confirmed: true };
    }
    if (!st) await conn.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 0 }).catch(() => {});
  }
  return { signature, sent: batch.length, confirmed: false };
}

export async function runPayouts() {
  if (await payoutsPaused()) return { status: "paused" as const };
  const conn = new Connection(rpcUrl(), "confirmed");

  const before = await reconcile(conn);
  if (before.stillPending > 0) return { status: "waiting_for_pending" as const, reconcile: before };

  const kp = payoutKeypair();
  const balance = await conn.getBalance(kp.publicKey, "confirmed");
  const plan = await duePayouts(balance);
  const batches: any[] = [];
  for (let i = 0; i < plan.due.length; i += PAYOUTS_PER_TX) {
    const r = await sendBatch(conn, kp, plan.due.slice(i, i + PAYOUTS_PER_TX));
    batches.push(r);
    if (r.error) break; // stop on the first problem; the next run starts clean
  }
  return {
    status: "done" as const,
    reconcile: before,
    payoutWalletSol: balance / 1e9,
    waiting: plan.waiting,
    payoutWalletShort: plan.payoutWalletShort,
    dailyCapReached: plan.dailyCapReached,
    batches,
  };
}
