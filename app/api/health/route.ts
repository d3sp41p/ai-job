import { rpc, select, publicKeyIsBlocked, DbError } from "@/lib/server/db";

export const dynamic = "force-dynamic";

const EXPECTED_TABLES = 15;

// Public health check. Shows only yes/no facts, never data or keys.
export async function GET() {
  try {
    const h = await rpc<{ tables: number; rls_off: number; payouts_paused: boolean }>("health_check");
    const blocked = await publicKeyIsBlocked().catch(() => null);
    const [lastHour] = await select("payroll_hours", { columns: "hour_start,workers", filters: { settled: "is.true" }, order: "hour_start.desc", limit: 1 }).catch(() => []);
    const ok = h.tables === EXPECTED_TABLES && h.rls_off === 0 && blocked !== false;
    return Response.json({
      ok,
      database: "connected",
      tables: `${h.tables}/${EXPECTED_TABLES}`,
      rls: h.rls_off === 0 ? "on for every table" : `OFF on ${h.rls_off} table(s)`,
      public_key_can_read: blocked === null ? "not checked" : !blocked,
      payouts_paused: h.payouts_paused,
      // only "is it set", never the values
      session_secret: (process.env.SESSION_SECRET || "").trim().length >= 32 ? "set" : "missing or shorter than 32",
      turnstile: {
        site_key: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? "set" : "missing",
        secret_key: process.env.TURNSTILE_SECRET_KEY ? "set" : "missing",
      },
      payout_key: (process.env.PAYOUT_WALLET_SECRET_KEY || "").trim() ? "set" : "missing",
      admin_password: (process.env.ADMIN_PASSWORD || "").trim().length >= 12 ? "set" : "missing or shorter than 12",
      cron_secret: (process.env.CRON_SECRET || "").trim().length >= 16 ? "set" : "missing or shorter than 16",
      last_payroll_hour: lastHour ? lastHour.hour_start : "never",
    }, { status: ok ? 200 : 500 });
  } catch (e) {
    const err = e as DbError;
    const isDb = e instanceof DbError;
    const hint =
      err.code === "not_configured" ? "Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, then redeploy." :
      err.code === "PGRST202" ? "Tables not created yet: run supabase/migrations/0001_init.sql in the SQL Editor." :
      err.status === 401 ? "The secret key is wrong." : "Unexpected database error.";
    return Response.json({
      ok: false,
      database: "error",
      hint,
      // safe diagnostics: HTTP status, Postgres/PostgREST code, short message. Never keys.
      detail: isDb
        ? { status: err.status, code: err.code ?? null, message: String(err.message).slice(0, 200) }
        : { message: String((e as Error)?.message || e).slice(0, 200) },
    }, { status: 500 });
  }
}
