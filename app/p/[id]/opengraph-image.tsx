import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { cardHeadline, cardWho, getCard } from "@/lib/server/share";

export const alt = "AI Gave Me a Job";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#EEECE2";
const SOFT = "#9B9E92";
const MARK = "#F1E05A";
const STAMP = "#FF5E4F";

const font = (w: number) => readFile(join(process.cwd(), "lib/fonts", `plex-${w}.woff`)).catch(() => null);

// The preview X shows under a shared /p/<id> link
export default async function CardImage({ params }: { params: Promise<{ id: string }> }) {
  const [card, regular, bold] = await Promise.all([getCard((await params).id), font(400), font(700)]);
  const fonts = [
    regular && { name: "Plex", data: regular, weight: 400 as const, style: "normal" as const },
    bold && { name: "Plex", data: bold, weight: 700 as const, style: "normal" as const },
  ].filter(Boolean) as { name: string; data: Buffer; weight: 400 | 700; style: "normal" }[];
  const kind = card?.kind ?? "resume";
  const label = kind === "salary" ? "PAYSLIP" : kind === "promotion" ? "PROMOTED" : "ON PAYROLL";
  const rows: [string, string][] = !card
    ? []
    : kind === "salary"
      ? [["Title", card.title], ["Assignments", String(card.tasks)], ["On payroll", `${card.days} days`]]
      : kind === "promotion"
        ? [["Was", card.previous ?? ""], ["Assignments", String(card.tasks)]]
        : [["On payroll", `${card.days} days`], ["Assignments", String(card.tasks)], ["Earned", `${card.earned ?? 0} SOL`]];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0A0B09", padding: 64, color: INK, fontFamily: fonts.length ? "Plex" : "sans-serif", position: "relative" }}>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700 }}>AI Gave Me a Job</div>
        <div style={{ display: "flex", marginTop: 36, fontSize: 34, color: SOFT }}>{card ? cardWho(card) : "Employee"}</div>
        <div style={{ display: "flex", marginTop: 8, fontSize: card && cardHeadline(card).length > 22 ? 84 : 110, fontWeight: 700, lineHeight: 1, letterSpacing: -3, maxWidth: 1000 }}>
          {card ? cardHeadline(card) : "Now hiring"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 36, gap: 10 }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: "flex", fontSize: 32 }}>
              <span style={{ color: SOFT, width: 260 }}>{k}</span>
              <span style={{ fontWeight: 700 }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", position: "absolute", left: 64, right: 64, bottom: 56, background: MARK, color: "#0A0B09", borderRadius: 32, padding: "14px 28px", fontSize: 26, fontWeight: 700 }}>
          hiredby.fun · 100% of fees go to the workers
        </div>
        <div style={{ display: "flex", position: "absolute", right: 70, top: 70, border: `8px solid ${STAMP}`, color: STAMP, fontSize: 48, fontWeight: 700, padding: "6px 22px", transform: "rotate(-8deg)" }}>
          {label}
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
