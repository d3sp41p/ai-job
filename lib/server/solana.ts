// Server-only Solana reads through Helius (plain JSON-RPC + Enhanced Transactions API).
// No private keys here: this file only READS the chain.

if (typeof window !== "undefined") {
  throw new Error("lib/server/solana.ts must never run in the browser");
}

export class ChainError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

export function network(): "mainnet" | "devnet" {
  const n = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet").trim().toLowerCase();
  return n === "mainnet" || n === "mainnet-beta" ? "mainnet" : "devnet";
}

function heliusKey() {
  const k = (process.env.HELIUS_API_KEY || "").trim();
  if (!k) throw new ChainError("HELIUS_API_KEY is not set", "not_configured");
  return k;
}

export function rpcUrl() {
  return `https://${network()}.helius-rpc.com/?api-key=${heliusKey()}`;
}

export function tokenMint(): string {
  const m = (process.env.NEXT_PUBLIC_TOKEN_MINT || "").trim();
  if (!m) throw new ChainError("NEXT_PUBLIC_TOKEN_MINT is not set", "no_mint");
  return m;
}

// ---------- address validation (real base58 decode, must be 32 bytes) ----------
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function isValidAddress(a: string): boolean {
  if (typeof a !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return false;
  let n = 0n;
  for (const c of a) n = n * 58n + BigInt(B58.indexOf(c));
  let bytes = 0;
  while (n > 0n) {
    n >>= 8n;
    bytes++;
  }
  let zeros = 0;
  while (a[zeros] === "1") zeros++;
  return bytes + zeros === 32;
}

export function decodeBase58(a: string): Buffer {
  let n = 0n;
  for (const c of a) {
    const i = B58.indexOf(c);
    if (i < 0) throw new Error("bad base58");
    n = n * 58n + BigInt(i);
  }
  const out: number[] = [];
  while (n > 0n) {
    out.unshift(Number(n & 255n));
    n >>= 8n;
  }
  let zeros = 0;
  while (a[zeros] === "1") zeros++;
  return Buffer.from([...new Array(zeros).fill(0), ...out]);
}

// ---------- JSON-RPC ----------
// Public Solana node: a backup for plain reads when Helius says "too many requests"
const publicRpc = () => (network() === "mainnet" ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com");

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const call = (url: string) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      cache: "no-store",
    });
  let res: Response | null = null;
  try {
    res = await call(rpcUrl());
  } catch {
    res = null;
  }
  if (!res || res.status === 429 || res.status >= 500) {
    // Helius busy or down: try the public node once
    try {
      const backup = await call(publicRpc());
      if (backup.ok) res = backup;
    } catch {
      /* keep the Helius answer */
    }
  }
  if (!res) throw new ChainError("Solana RPC unreachable", "rpc_down");
  if (res.status === 401 || res.status === 403) throw new ChainError("Helius key rejected", "bad_key");
  if (res.status === 429) throw new ChainError("Helius rate limit", "rate_limited");
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.error) {
    throw new ChainError(body?.error?.message || `RPC error ${res.status}`, "rpc_error");
  }
  return body.result as T;
}

/** SOL balance of any address */
export async function getSolBalance(address: string): Promise<number> {
  const r = await rpc<{ value: number }>("getBalance", [address, { commitment: "confirmed" }]);
  return r.value / 1e9;
}

/** Token balance of `owner` for our coin (sums all token accounts, works for SPL and Token-2022) */
export async function getTokenBalance(owner: string, mint = tokenMint()): Promise<number> {
  const r = await rpc<{ value: any[] }>("getTokenAccountsByOwner", [
    owner,
    { mint },
    { encoding: "jsonParsed", commitment: "confirmed" },
  ]);
  let raw = 0n;
  let decimals = Number(process.env.TOKEN_DECIMALS || 6);
  for (const acc of r.value || []) {
    const ta = acc?.account?.data?.parsed?.info?.tokenAmount;
    if (!ta) continue;
    raw += BigInt(ta.amount);
    decimals = ta.decimals;
  }
  return Number(raw) / 10 ** decimals;
}

// ---------- hold history ----------
type BalanceEvent = { t: number; delta: number; sig: string }; // t in ms, delta in whole tokens

async function fetchHistoryPage(owner: string, before?: string): Promise<any[]> {
  const base = `https://${network()}.helius-rpc.com/v0/addresses/${owner}/transactions`;
  const q = new URLSearchParams({ "api-key": heliusKey(), limit: "100", "token-accounts": "balanceChanged" });
  if (before) q.set("before-signature", before);
  let res = await fetch(`${base}?${q}`, { cache: "no-store" });
  if (res.status === 404) {
    // older Helius host, same data
    const legacy = `https://${network() === "mainnet" ? "api" : "api-devnet"}.helius.xyz/v0/addresses/${owner}/transactions`;
    const q2 = new URLSearchParams({ "api-key": heliusKey(), limit: "100" });
    if (before) q2.set("before", before);
    res = await fetch(`${legacy}?${q2}`, { cache: "no-store" });
  }
  if (res.status === 429) throw new ChainError("Helius rate limit", "rate_limited");
  if (!res.ok) throw new ChainError(`History error ${res.status}`, "history_error");
  const body = await res.json().catch(() => []);
  return Array.isArray(body) ? body : [];
}

/** Net change of `owner`'s coin balance in one parsed transaction */
function deltaFor(tx: any, owner: string, mint: string): number {
  let delta = 0;
  let found = false;
  for (const acc of tx?.accountData || []) {
    for (const ch of acc?.tokenBalanceChanges || []) {
      if (ch?.mint !== mint || ch?.userAccount !== owner) continue;
      const r = ch.rawTokenAmount;
      if (!r) continue;
      delta += Number(r.tokenAmount) / 10 ** Number(r.decimals);
      found = true;
    }
  }
  if (found) return delta;
  // fallback: simple transfers list (UI amounts)
  for (const tr of tx?.tokenTransfers || []) {
    if (tr?.mint !== mint) continue;
    const amt = Number(tr.tokenAmount) || 0;
    if (tr.toUserAccount === owner) delta += amt;
    if (tr.fromUserAccount === owner) delta -= amt;
  }
  return delta;
}

const MAX_PAGES = 5; // up to 500 transactions back

/**
 * Rebuilds the balance timeline backwards from the current balance.
 * holdStart = the last moment the balance rose from below `minHold` to `minHold`+.
 * minBalance24h = the lowest balance at any point in the last 24 hours.
 */
export async function getHoldInfo(owner: string, minHold: number, mint = tokenMint()) {
  const now = Date.now();
  const dayAgo = now - 24 * 3600_000;
  const current = await getTokenBalance(owner, mint);

  let running = current;
  let minBalance24h = current;
  let holdStart: number | null = null;
  let crossed = current < minHold; // below the minimum right now: no streak at all
  let oldestSeen: number | null = null;
  let complete = false;
  let before: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const txs = await fetchHistoryPage(owner, before);
    if (txs.length === 0) {
      complete = true;
      break;
    }
    for (const tx of txs) {
      const t = (Number(tx.timestamp) || 0) * 1000;
      const delta = deltaFor(tx, owner, mint);
      if (delta === 0) continue;
      const ev: BalanceEvent = { t, delta, sig: tx.signature };
      const balanceBefore = running - ev.delta;
      if (ev.t >= dayAgo) minBalance24h = Math.min(minBalance24h, balanceBefore);
      if (!crossed && balanceBefore < minHold - 1e-6) {
        // includes "negative" balances: missing history is treated as not holding (safe side)
        holdStart = ev.t;
        crossed = true;
      }
      running = balanceBefore;
      oldestSeen = ev.t;
      if (crossed && ev.t < dayAgo) break;
    }
    if (crossed && (oldestSeen ?? now) < dayAgo) break;
    before = txs[txs.length - 1]?.signature;
    if (txs.length < 100) {
      complete = true;
      break;
    }
  }

  if (!crossed) {
    // never dipped below the minimum in the history we saw
    holdStart = oldestSeen ?? now;
  }
  minBalance24h = Math.max(0, minBalance24h);

  return {
    balance: current,
    minBalance24h,
    holdStart: current >= minHold ? holdStart : null,
    historyComplete: complete,
  };
}
