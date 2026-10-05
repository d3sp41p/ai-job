// Creates the TEST coin on Solana devnet and sends it to the team's test wallets.
// Safe to run again: it reuses the same coin and only tops wallets up to their target.
//
//   npm install
//   node index.mjs
//
// It never asks for your Phantom keys. It makes its own throwaway "issuer" wallet
// in .devnet/ (devnet only, worthless, never committed to git).

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, clusterApiUrl } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, getMint } from "@solana/spl-token";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DECIMALS = 6;
const UNIT = 10n ** BigInt(DECIMALS);

// address -> how many test coins it should hold (tiers: 100k x1.0, 1M x2.0, 5M x3.0)
const RECIPIENTS = [
  ["9PySDhu5T74rtJvvef5F95izZxac5PcSf3zuQCDdtaYo", 5_000_000n], // top tier x3.0
  ["4U3kJYYpEmUwq5ZEB7ZdMtqcsd4H2cryoT7t3fnYCo4o", 1_000_000n], // x2.0
  ["AEFzGoo7DMb5NbTnKqeAyo6oJfuzkSyLfrgEvnm8erY4", 150_000n],   // just above the 100k minimum
];
const ISSUER_RESERVE = 50_000_000n; // kept by the issuer for later tests

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, ".devnet");
const keyFile = path.join(dir, "issuer-keypair.json");
const tokenFile = path.join(dir, "token.json");
const conn = new Connection(process.env.RPC_URL || clusterApiUrl("devnet"), "confirmed");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadIssuer() {
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(keyFile)) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(keyFile, "utf8"))));
  }
  const kp = Keypair.generate();
  fs.writeFileSync(keyFile, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

async function ensureSol(issuer) {
  let bal = await conn.getBalance(issuer.publicKey);
  if (bal >= 0.02 * LAMPORTS_PER_SOL) return;
  console.log("Issuer needs devnet SOL, asking the devnet faucet...");
  try {
    const sig = await conn.requestAirdrop(issuer.publicKey, 1 * LAMPORTS_PER_SOL);
    await conn.confirmTransaction(sig, "confirmed");
    await sleep(1500);
    bal = await conn.getBalance(issuer.publicKey);
  } catch {
    /* faucet is often rate limited */
  }
  if (bal < 0.02 * LAMPORTS_PER_SOL) {
    console.log("\n>>> The automatic faucet refused. Do this once:");
    console.log("    1. Open https://faucet.solana.com (network: Devnet)");
    console.log(`    2. Paste this address: ${issuer.publicKey.toBase58()}`);
    console.log("    3. Request 0.5 SOL (0.02 is enough), then run `node index.mjs` again.\n");
    console.log("    (Or send 0.02 devnet SOL to it from your Phantom on Devnet.)");
    process.exit(1);
  }
}

async function main() {
  const issuer = loadIssuer();
  console.log(`Issuer (throwaway, devnet only): ${issuer.publicKey.toBase58()}`);
  await ensureSol(issuer);

  let mint;
  if (fs.existsSync(tokenFile)) {
    mint = new PublicKey(JSON.parse(fs.readFileSync(tokenFile, "utf8")).mint);
    console.log(`Using existing test coin: ${mint.toBase58()}`);
  } else {
    mint = await createMint(conn, issuer, issuer.publicKey, null, DECIMALS);
    fs.writeFileSync(tokenFile, JSON.stringify({ mint: mint.toBase58(), decimals: DECIMALS }, null, 2));
    console.log(`Created test coin: ${mint.toBase58()}`);
  }

  const targets = [...RECIPIENTS, [issuer.publicKey.toBase58(), ISSUER_RESERVE]];
  for (const [addr, want] of targets) {
    const owner = new PublicKey(addr);
    const ata = await getOrCreateAssociatedTokenAccount(conn, issuer, mint, owner);
    const have = BigInt(ata.amount) / UNIT;
    if (have < want) {
      await mintTo(conn, issuer, mint, ata.address, issuer, (want - have) * UNIT);
      console.log(`  ${addr}: ${have} -> ${want}`);
    } else {
      console.log(`  ${addr}: already has ${have}`);
    }
  }

  const info = await getMint(conn, mint);
  console.log("\nDone.");
  console.log(`Total supply now: ${(info.supply / UNIT).toString()} (decimals ${info.decimals})`);
  console.log("\n>>> Send this to Claude (it is public, safe to share):");
  console.log(`    TEST MINT: ${mint.toBase58()}`);
  console.log(`    Explorer:  https://explorer.solana.com/address/${mint.toBase58()}?cluster=devnet\n`);
}

main().catch((e) => {
  console.error("\nFAILED:", e?.message || e);
  console.error("Copy this whole error and send it to Claude.");
  process.exit(1);
});
