import { isAdmin, denied, logAdmin } from "@/lib/server/admin";
import { insert } from "@/lib/server/db";
import { isValidAddress } from "@/lib/server/solana";
import { runPayouts } from "@/lib/server/payouts";
import { runPayroll } from "@/lib/server/payroll";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Admin buttons: pause/resume payouts, ban/unban an address, run the hourly job now.
export async function POST(req: Request) {
  if (!(await isAdmin())) return denied();
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const address = typeof body.address === "string" ? body.address.trim() : "";

  try {
    if (action === "pause" || action === "resume") {
      await insert("admin_settings", { key: "payouts_paused", value: action === "pause", updated_at: new Date().toISOString() }, "key");
      await logAdmin(action === "pause" ? "payouts_paused" : "payouts_resumed");
      return Response.json({ ok: true });
    }
    if (action === "ban" || action === "unban") {
      if (!isValidAddress(address)) return Response.json({ error: "Not a Solana address." }, { status: 400 });
      // ban also works for an address we haven't seen yet
      await insert("wallets", { address, banned: action === "ban" }, "address");
      await logAdmin(action, { address });
      return Response.json({ ok: true });
    }
    if (action === "run_now") {
      // same as the hourly job: settle finished hours, then send what's due (respects the pause)
      const payroll = await runPayroll().catch((e) => ({ error: String(e?.message || e).slice(0, 200) }));
      const payouts = await runPayouts().catch((e) => ({ error: String(e?.message || e).slice(0, 200) }));
      await logAdmin("run_now", { payroll: !("error" in payroll), payouts: "error" in payouts ? payouts.error : payouts.status });
      return Response.json({ ok: true, payroll, payouts });
    }
    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch {
    return Response.json({ error: "That didn't work. Try again." }, { status: 503 });
  }
}
