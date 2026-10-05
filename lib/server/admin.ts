// Admin access: one shared password (ADMIN_PASSWORD), then a signed httpOnly cookie for 12 hours.
// Every admin action is written to admin_log. Server only.

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { insert } from "./db";
import { ipHash } from "./session";

if (typeof window !== "undefined") {
  throw new Error("lib/server/admin.ts must never run in the browser");
}

const COOKIE = "aij_admin";
const HOURS = 12;

function key() {
  const s = (process.env.SESSION_SECRET || "").trim();
  if (s.length < 32) throw new Error("SESSION_SECRET is missing");
  return s;
}
const sign = (payload: string) => createHmac("sha256", key()).update(`admin|${payload}`).digest("base64url");

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export function passwordOk(given: unknown) {
  const real = (process.env.ADMIN_PASSWORD || "").trim();
  if (real.length < 12 || typeof given !== "string") return false; // no password set = admin closed
  return same(given, real);
}

export async function startAdminSession() {
  const exp = String(Date.now() + HOURS * 3600_000);
  (await cookies()).set(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: HOURS * 3600,
  });
}

export async function endAdminSession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin() {
  const raw = (await cookies()).get(COOKIE)?.value || "";
  const [exp, sig] = raw.split(".");
  if (!exp || !sig || !(Number(exp) > Date.now())) return false;
  try {
    return same(sig, sign(exp));
  } catch {
    return false;
  }
}

export const denied = () => Response.json({ error: "Admins only." }, { status: 401 });

export async function logAdmin(action: string, details: object = {}) {
  await insert("admin_log", { actor: `ip:${(await ipHash()).slice(0, 8)}`, action, details }).catch(() => {});
}
