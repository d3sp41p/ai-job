// Server-only database client for Supabase (PostgREST over fetch).
// The secret key lives only in server env vars (no NEXT_PUBLIC_ prefix),
// so Next.js never ships it to the browser. Never import this from a client component.

if (typeof window !== "undefined") {
  throw new Error("lib/server/db.ts must never run in the browser");
}

function baseUrl() {
  // accept "https://x.supabase.co", with or without a trailing "/" or "/rest/v1"
  return (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/, "");
}

function config() {
  const url = baseUrl();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new DbError("Database is not configured", 500, "not_configured");
  return { url, key };
}

export class DbError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

function headers(key: string, extra?: Record<string, string>) {
  // New-style keys (sb_secret_...) go only in `apikey`; legacy JWT keys also need Authorization.
  const h: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (!key.startsWith("sb_")) h.Authorization = `Bearer ${key}`;
  return { ...h, ...extra };
}

async function request<T>(path: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
  const { url, key } = config();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: headers(key, init.prefer ? { Prefer: init.prefer } : undefined),
    cache: "no-store",
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { message: `Non-JSON response (HTTP ${res.status})` };
  }
  if (!res.ok) {
    // never include the key or full request in errors
    throw new DbError(body?.message || `Database error ${res.status}`, res.status, body?.code);
  }
  return body as T;
}

const enc = encodeURIComponent;

/** select rows. filters use PostgREST syntax, e.g. { address: "eq.ABC" } */
export function select<T = any>(
  table: string,
  opts: { columns?: string; filters?: Record<string, string>; order?: string; limit?: number } = {}
) {
  const q = new URLSearchParams();
  q.set("select", opts.columns || "*");
  for (const [k, v] of Object.entries(opts.filters || {})) q.append(k, v);
  if (opts.order) q.set("order", opts.order);
  if (opts.limit) q.set("limit", String(opts.limit));
  return request<T[]>(`${enc(table)}?${q}`);
}

export function insert<T = any>(table: string, rows: object | object[], upsertOn?: string) {
  const q = upsertOn ? `?on_conflict=${enc(upsertOn)}` : "";
  return request<T[]>(`${enc(table)}${q}`, {
    method: "POST",
    body: JSON.stringify(rows),
    prefer: upsertOn ? "return=representation,resolution=merge-duplicates" : "return=representation",
  });
}

export function update<T = any>(table: string, filters: Record<string, string>, patch: object) {
  const q = new URLSearchParams(filters);
  return request<T[]>(`${enc(table)}?${q}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
    prefer: "return=representation",
  });
}

/** call a Postgres function (used for anything that must be atomic) */
export function rpc<T = any>(fn: string, args: object = {}) {
  return request<T>(`rpc/${enc(fn)}`, { method: "POST", body: JSON.stringify(args) });
}

/** check that the browser (public anon/publishable key) can NOT read our tables */
export async function publicKeyIsBlocked(): Promise<boolean | null> {
  const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  const url = baseUrl();
  if (!anon || !url) return null;
  const res = await fetch(`${url}/rest/v1/wallets?select=address&limit=1`, {
    headers: headers(anon),
    cache: "no-store",
  });
  if (!res.ok) return true; // permission denied = good
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length === 0 ? null : false;
}
