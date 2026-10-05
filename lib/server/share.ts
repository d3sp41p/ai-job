// Share cards for X: each share gets its own link /p/<id> whose preview image is the card.
// Card numbers come from our database, never from the browser. Server only.

import { randomBytes } from "node:crypto";
import { RANKS, rankFor } from "@/lib/config";
import { insert, select } from "./db";
import { getResume } from "./hold";
import type { Session } from "./session";

export type CardData = {
  kind: "salary" | "promotion" | "resume";
  address: string;
  name: string | null;
  title: string; // rank
  tasks: number;
  days: number;
  amount?: number; // salary
  tx?: string; // salary
  previous?: string; // promotion
  earned?: number; // resume
};

const DB_KIND = { salary: "payslip", promotion: "promotion", resume: "resume" } as const;

export class ShareError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

async function profile(address: string) {
  const r = await getResume(address);
  return { address, name: r.name, title: r.rank, tasks: r.tasksCompleted, days: r.daysHeld, earned: r.earnedSol };
}

/** Build a card from server data and save it. Salary and promotion cards are only for your own address. */
export async function createCard(s: Session | null, kind: CardData["kind"], address: string): Promise<string> {
  let data: CardData;
  if (kind === "resume") {
    const p = await profile(address);
    data = { kind, address, name: p.name, title: p.title, tasks: p.tasks, days: p.days, earned: Math.round(p.earned * 1000) / 1000 };
  } else {
    if (!s?.a || s.a !== address) throw new ShareError("Add your address on this device first.", 401);
    const p = await profile(address);
    if (kind === "salary") {
      const [pay] = await select("payouts", {
        columns: "amount_sol,tx_signature",
        filters: { wallet: `eq.${address}`, status: "eq.paid" },
        order: "updated_at.desc",
        limit: 1,
      });
      if (!pay) throw new ShareError("No salary has been sent to this address yet.", 404);
      data = { kind, address, name: p.name, title: p.title, tasks: p.tasks, days: p.days, amount: Number(pay.amount_sol), tx: pay.tx_signature };
    } else {
      const r = rankFor(p.tasks);
      if (r.index === 0) throw new ShareError("No promotion yet. Keep working.", 404);
      data = { kind, address, name: p.name, title: r.title, previous: RANKS[r.index - 1].title, tasks: p.tasks, days: p.days };
    }
  }
  const id = randomBytes(6).toString("base64url");
  await insert("share_cards", { id, wallet: address, kind: DB_KIND[kind], data });
  return id;
}

export async function getCard(id: string): Promise<CardData | null> {
  if (!/^[A-Za-z0-9_-]{6,16}$/.test(id)) return null;
  const [row] = await select("share_cards", { columns: "data", filters: { id: `eq.${id}` }, limit: 1 }).catch(() => []);
  return (row?.data as CardData) ?? null;
}

export const cardWho = (c: CardData) => c.name || `${c.address.slice(0, 4)}…${c.address.slice(-4)}`;

export function cardHeadline(c: CardData) {
  if (c.kind === "salary") return `Paid ${Number(c.amount).toFixed(3)} SOL`;
  if (c.kind === "promotion") return `Promoted to ${c.title}`;
  return c.title;
}
