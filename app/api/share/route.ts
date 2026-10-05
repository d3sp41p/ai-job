import { ipHash, readSession } from "@/lib/server/session";
import { allow, tooMany } from "@/lib/server/guard";
import { createCard, ShareError } from "@/lib/server/share";
import { isValidAddress } from "@/lib/server/solana";

export const dynamic = "force-dynamic";

// Make a share link /p/<id>. The card's numbers are read from our database here.
export async function POST(req: Request) {
  if (!(await allow(`share:ip:${await ipHash()}`, 20, 600))) return tooMany();
  const body = await req.json().catch(() => ({}));
  const kind = body.kind;
  const address = typeof body.address === "string" ? body.address.trim() : "";
  if ((kind !== "salary" && kind !== "promotion" && kind !== "resume") || !isValidAddress(address)) {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  try {
    const id = await createCard(await readSession(), kind, address);
    return Response.json({ id, path: `/p/${id}` });
  } catch (e) {
    if (e instanceof ShareError) return Response.json({ error: e.message }, { status: e.status });
    return Response.json({ error: "Couldn't make a link right now." }, { status: 503 });
  }
}
