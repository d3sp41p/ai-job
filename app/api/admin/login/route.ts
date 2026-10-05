import { ipHash } from "@/lib/server/session";
import { allow, tooMany } from "@/lib/server/guard";
import { endAdminSession, logAdmin, passwordOk, startAdminSession } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

// Admin sign-in with ADMIN_PASSWORD. 5 tries per 10 minutes per network.
export async function POST(req: Request) {
  if (!(await allow(`admin:ip:${await ipHash()}`, 5, 600))) return tooMany();
  const body = await req.json().catch(() => ({}));
  if (!passwordOk(body.password)) {
    await logAdmin("login_failed");
    return Response.json({ error: "Wrong password." }, { status: 401 });
  }
  await startAdminSession();
  await logAdmin("login");
  return Response.json({ ok: true });
}

export async function DELETE() {
  await endAdminSession();
  return Response.json({ ok: true });
}
