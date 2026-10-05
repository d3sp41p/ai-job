import { ensureSession, ipHash } from "@/lib/server/session";
import { allow, tooMany } from "@/lib/server/guard";
import { finishShift } from "@/lib/server/shifts";
import { WorkerError } from "@/lib/server/workers";

export const dynamic = "force-dynamic";

// Hand in a shift's result. Accepted once, only from the device that started it.
export async function POST(req: Request) {
  if (!(await allow(`finish:ip:${await ipHash()}`, 30, 600))) return tooMany();
  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Bad request." }, { status: 400 });
  try {
    const s = await ensureSession();
    return Response.json(await finishShift(s, id, body.performance, body.summary));
  } catch (e) {
    if (e instanceof WorkerError) return Response.json({ error: e.message, code: e.code }, { status: e.status });
    return Response.json({ error: "HR lost your report. Try again." }, { status: 503 });
  }
}
