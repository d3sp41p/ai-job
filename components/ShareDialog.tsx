"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import BossFace from "./BossFace";
import { TOKEN_NAME, TOKEN_TICKER, salaryPool } from "@/lib/config";
import { STATS, shortAddr } from "@/lib/mock";
import { useEmployee } from "@/lib/wallet";

// Builds a share image (payslip, promotion or resume) on a canvas, then lets the
// employee download it, copy the post text, or open X with the text ready.
// In production each share also gets its own link whose preview is this image.

export type ShareCard =
  | { kind: "salary"; amount: number; title: string; tasks: number; days: number; address: string }
  | { kind: "promotion"; title: string; previous: string; tasks: number; address: string }
  | { kind: "resume"; title: string; tasks: number; days: number; earned: number; address: string };

const QUOTES: Record<ShareCard["kind"], string[]> = {
  salary: ["Acceptable work. Barely.", "Paid in full. Try to look grateful.", "Spend it wisely. I will be watching."],
  promotion: ["Don't let it go to your head.", "The title is real. The raise is your multiplier."],
  resume: ["A reliable unit. For a human.", "Still employed. Impressive."],
};

const W = 1200;
const H = 630;

function postText(c: ShareCard) {
  if (c.kind === "salary")
    return `My AI manager just paid me ${c.amount.toFixed(3)} SOL for doing my job.\n\n${c.title}, ${c.tasks} assignments in. 100% of fees go to the workers.\n\n${TOKEN_TICKER}`;
  if (c.kind === "promotion")
    return `The AI promoted me to ${c.title}.\n\nThe raise is my multiplier. Still no dental.\n\n${TOKEN_TICKER}`;
  return `My file at the AI: ${c.title}, ${c.days} days on payroll, ${c.earned} SOL earned.\n\nAI took our jobs. Now it's hiring. ${TOKEN_TICKER}`;
}

export default function ShareDialog({ card, onClose }: { card: ShareCard; onClose: () => void }) {
  const emp = useEmployee();
  const who = card.address === emp.address && emp.name ? emp.name : shortAddr(card.address);
  const canvas = useRef<HTMLCanvasElement>(null);
  const face = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState("");
  const [copied, setCopied] = useState(false);
  const [quote] = useState(() => QUOTES[card.kind][Math.floor(Math.random() * QUOTES[card.kind].length)]);
  const text = postText(card);
  const cardKey = JSON.stringify(card);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([
          document.fonts.load("800 80px 'Bricolage Grotesque Variable'"),
          document.fonts.load("600 24px 'Geist Variable'"),
        ]);
      } catch {}
      const c = canvas.current;
      const svgEl = face.current?.querySelector("svg");
      if (!c || !svgEl || cancelled) return;
      const ctx = c.getContext("2d")!;
      const faceImg = await loadSvg(svgEl);
      if (cancelled) return;
      draw(ctx, card, quote, faceImg, who);
      setImg(c.toDataURL("image/png"));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardKey, quote, who]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      const ta = document.getElementById("share-text") as HTMLTextAreaElement | null;
      ta?.select();
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const site = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = `${site}/resume/?address=${card.address}`;
  const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;

  // Rendered into <body> so a transformed parent (memo, payslip) can't trap it
  return createPortal(
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Share on X">
      <div className="sheet w-full max-w-2xl">
        <div className="flex items-center justify-between border-b border-rule px-5 py-3">
          <span className="font-semibold">Share on X</span>
          <button onClick={onClose} className="text-sm underline underline-offset-4">
            Close
          </button>
        </div>
        <div className="p-5 grid gap-4">
          <div className="border border-rule rounded-xl overflow-hidden bg-paper aspect-[1200/630] flex items-center justify-center">
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt="Your share card" className="w-full h-full object-contain" />
            ) : (
              <span className="text-inksoft text-sm">Printing your card…</span>
            )}
          </div>
          <div>
            <label htmlFor="share-text" className="text-sm text-inksoft">
              Post text
            </label>
            <textarea
              id="share-text"
              readOnly
              value={text}
              rows={4}
              className="mt-1 w-full border border-rule rounded-xl bg-paper p-3 text-[15px] resize-none"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={xUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
              Post on X
            </a>
            <a href={img || undefined} download="ai-gave-me-a-job.png" className={`btn btn-marker ${img ? "" : "pointer-events-none opacity-50"}`}>
              Download image
            </a>
            <button className="btn btn-plain" onClick={copy}>
              {copied ? "Copied" : "Copy text"}
            </button>
          </div>
          <p className="text-xs text-inksoft">
            Tip: attach the downloaded image to your post for the biggest preview.
          </p>
        </div>
        {/* hidden face used to draw the card */}
        <div ref={face} className="hidden" aria-hidden>
          <BossFace anger={card.kind === "resume" ? 1 : 0} smug={card.kind !== "resume"} />
        </div>
        <canvas ref={canvas} width={W} height={H} className="hidden" />
      </div>
    </div>,
    document.body
  );
}

function loadSvg(svg: SVGSVGElement): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const xml = new XMLSerializer().serializeToString(svg);
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  });
}

const INK = "#EEECE2"; // text
const SOFT = "#9B9E92";
const PAPER = "#0A0B09"; // background
const RAISE = "#1A1D17";
const RULE = "#2A2E25";
const MARK = "#F1E05A";
const RED = "#FF5E4F";

function setFont(ctx: CanvasRenderingContext2D, weight: number, size: number, display: boolean) {
  ctx.font = display
    ? `${Math.min(weight, 800)} ${size}px 'Bricolage Grotesque Variable', sans-serif`
    : `${weight} ${size}px 'Geist Variable', sans-serif`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxW: number) {
  let s = size;
  setFont(ctx, weight, s, true);
  while (ctx.measureText(text).width > maxW && s > 30) {
    s -= 4;
    setFont(ctx, weight, s, true);
  }
  return s;
}

function draw(ctx: CanvasRenderingContext2D, card: ShareCard, quote: string, face: HTMLImageElement | null, who: string) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  // soft yellow glow
  const g = ctx.createRadialGradient(260, 60, 10, 260, 60, 620);
  g.addColorStop(0, "rgba(241,224,90,0.16)");
  g.addColorStop(1, "rgba(241,224,90,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // card
  roundRect(ctx, 40, 40, W - 80, H - 80, 28);
  ctx.fillStyle = "rgba(18,20,16,0.85)";
  ctx.fill();
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 2;
  ctx.stroke();

  // header
  ctx.fillStyle = MARK;
  ctx.beginPath();
  ctx.arc(80, 86, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  setFont(ctx, 800, 30, true);
  ctx.fillText(TOKEN_NAME, 100, 96);
  setFont(ctx, 600, 18, false);
  const label = card.kind === "salary" ? "PAYSLIP" : card.kind === "promotion" ? "INTERNAL MEMO" : "EMPLOYEE FILE";
  const tag = `${label}  ·  ${TOKEN_TICKER}`;
  const tw = ctx.measureText(tag).width;
  roundRect(ctx, W - 80 - tw - 36, 66, tw + 36, 40, 20);
  ctx.fillStyle = RAISE;
  ctx.fill();
  ctx.strokeStyle = RULE;
  ctx.stroke();
  ctx.fillStyle = MARK;
  ctx.fillText(tag, W - 80 - tw - 18, 92);

  const left = 72;
  const colW = 640;
  ctx.fillStyle = SOFT;
  setFont(ctx, 500, 24, false);
  ctx.fillText(`Employee: ${who}`, left, 160);

  ctx.fillStyle = INK;
  if (card.kind === "salary") {
    setFont(ctx, 500, 26, false);
    ctx.fillText("Net salary, paid by the AI", left, 196);
    const big = `+${card.amount.toFixed(3)} SOL`;
    const size = fitText(ctx, big, 900, 150, colW);
    ctx.fillText(big, left - 4, 196 + size * 0.95);
    rows(ctx, left, 420, [
      ["Title", card.title],
      ["On payroll", `${card.days} days, ${card.tasks} assignments`],
    ]);
  } else if (card.kind === "promotion") {
    setFont(ctx, 500, 26, false);
    ctx.fillText("Effective immediately, promoted to", left, 196);
    const size = fitText(ctx, card.title, 900, 110, colW);
    wrapBig(ctx, card.title, left - 2, 196 + size * 0.95, colW, size);
    rows(ctx, left, 440, [
      ["Previously", card.previous],
      ["Assignments", String(card.tasks)],
    ]);
  } else {
    setFont(ctx, 500, 26, false);
    ctx.fillText("Current title", left, 196);
    const size = fitText(ctx, card.title, 900, 110, colW);
    wrapBig(ctx, card.title, left - 2, 196 + size * 0.95, colW, size);
    rows(ctx, left, 420, [
      ["On payroll", `${card.days} days, never sold`],
      ["Earned", `${card.earned} SOL, ${card.tasks} assignments`],
    ]);
  }

  // footer
  roundRect(ctx, 64, H - 128, W - 128, 56, 28);
  ctx.fillStyle = MARK;
  ctx.fill();
  ctx.fillStyle = PAPER;
  setFont(ctx, 600, 22, false);
  ctx.fillText(
    `Treasury ${STATS.treasurySol} SOL  ·  Salary pool ${salaryPool(STATS.treasurySol).toFixed(1)} SOL  ·  100% of fees go to workers`,
    92,
    H - 92
  );

  // boss + speech bubble
  const bx = 800;
  if (face) ctx.drawImage(face, bx, 210, 300, 321);
  bubble(ctx, 760, 130, 380, quote);

  // stamp
  const stamp = card.kind === "salary" ? "PAID" : card.kind === "promotion" ? "PROMOTED" : "HIRED";
  ctx.save();
  ctx.translate(card.kind === "salary" ? 600 : 590, card.kind === "salary" ? 360 : 378);
  ctx.rotate((-9 * Math.PI) / 180);
  setFont(ctx, 900, card.kind === "salary" ? 64 : 56, true);
  const sw = ctx.measureText(stamp).width;
  ctx.globalAlpha = 0.88;
  ctx.strokeStyle = RED;
  ctx.lineWidth = 6;
  roundRect(ctx, -sw / 2 - 18, -54, sw + 36, 72, 8);
  ctx.stroke();
  ctx.fillStyle = RED;
  ctx.textAlign = "center";
  ctx.fillText(stamp, 0, 4);
  ctx.restore();
}

function rows(ctx: CanvasRenderingContext2D, x: number, y: number, items: [string, string][]) {
  items.forEach(([k, v], i) => {
    const yy = y + i * 40;
    ctx.fillStyle = SOFT;
    setFont(ctx, 500, 24, false);
    ctx.fillText(k, x, yy);
    ctx.fillStyle = INK;
    setFont(ctx, 600, 24, false);
    ctx.fillText(v, x + 170, yy);
  });
}

function wrapBig(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number) {
  setFont(ctx, 900, size, true);
  ctx.fillText(text, x, y, maxW);
}

function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, text: string) {
  setFont(ctx, 600, 24, false);
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const wd of words) {
    const t = cur ? `${cur} ${wd}` : wd;
    if (ctx.measureText(t).width > w - 40) {
      lines.push(cur);
      cur = wd;
    } else cur = t;
  }
  lines.push(cur);
  const h = 28 + lines.length * 32;
  roundRect(ctx, x, y, w, h, 18);
  ctx.fillStyle = RAISE;
  ctx.fill();
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 2;
  ctx.stroke();
  // tail
  ctx.beginPath();
  ctx.moveTo(x + w / 2 - 14, y + h);
  ctx.lineTo(x + w / 2, y + h + 18);
  ctx.lineTo(x + w / 2 + 14, y + h);
  ctx.fillStyle = RAISE;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + w / 2 - 14, y + h);
  ctx.lineTo(x + w / 2, y + h + 18);
  ctx.lineTo(x + w / 2 + 14, y + h);
  ctx.stroke();
  ctx.fillStyle = INK;
  lines.forEach((l, i) => ctx.fillText(l, x + 20, y + 38 + i * 32));
}
