import { ensureSession, ipHash } from "@/lib/server/session";
import { allow, tooMany, verifyCaptcha } from "@/lib/server/guard";
import { startShift } from "@/lib/server/shifts";
import { WorkerError } from "@/lib/server/workers";
import { ChainError } from "@/lib/server/solana";
import { GAMES } from "@/lib/games";

export const dynamic = "force-dynamic";

// Start a shift: captcha, then the server picks one of the 5 jobs for this difficulty.
// The cooldown starts now, even if the shift is never finished.
export async function POST(req: Request) {
  if (!(await allow(`shift:ip:${await ipHash()}`, 20, 600))) return tooMany();
  const body = await req.json().catch(() => ({}));
  const difficulty = body.difficulty;
  if (difficulty !== "easy" && difficulty !== "medium" && difficulty !== "hard") {
    return Response.json({ error: "Pick a shift first." }, { status: 400 });
  }
  if (!(await verifyCaptcha(body.captcha))) {
    return Response.json({ error: "The captcha didn't go through. Try it again.", code: "captcha" }, { status: 400 });
  }
  try {
    const s = await ensureSession();
    const r = await startShift(s, difficulty);
    const game = GAMES.find((g) => g.id === r.gameId)!;
    return Response.json({ ...r, name: game.name, brief: game.brief, difficulty });
  } catch (e) {
    if (e instanceof WorkerError) {
      return Response.json({ error: e.message, code: e.code, cooldownEndsAt: (e as any).cooldownEndsAt ?? null }, { status: e.status });
    }
    if (e instanceof ChainError) {
      return Response.json({ error: "Couldn't read your wallet right now. Try again in a minute.", code: "chain" }, { status: 503 });
    }
    return Response.json({ error: "HR is down. Try again." }, { status: 503 });
  }
}
