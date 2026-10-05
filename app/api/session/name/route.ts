import { readSession, ipHash } from "@/lib/server/session";
import { lockState } from "@/lib/server/workers";
import { allow, tooMany, cleanDisplayName } from "@/lib/server/guard";
import { update } from "@/lib/server/db";

export const dynamic = "force-dynamic";

// Change what the AI calls you. Only for the address in your session.
export async function POST(req: Request) {
  if (!(await allow(`name:ip:${await ipHash()}`, 20, 600))) return tooMany();
  const s = await readSession();
  if (!s?.a) return Response.json({ error: "Add your address first." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const raw = typeof body.name === "string" ? body.name : "";
  const name = raw.trim() ? cleanDisplayName(raw) : null;
  if (raw.trim() && !name) return Response.json({ error: "HR rejected that name. Try something else." }, { status: 400 });
  // a locked address can only be renamed from a locked device
  const lock = await lockState(s.a, s.d);
  if (lock.locked && !lock.lockedHere) return Response.json({ error: "This address is locked to another device." }, { status: 409 });
  await update("wallets", { address: `eq.${s.a}` }, { display_name: name });
  return Response.json({ name });
}
