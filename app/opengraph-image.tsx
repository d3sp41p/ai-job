import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "AI took your job. Now it's hiring.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Card shown when the site link is shared on X.
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#0A0B09",
          padding: 64,
          fontFamily: "sans-serif",
          color: "#EEECE2",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%" }}>
          <div style={{ fontSize: 34, fontWeight: 700 }}>AI Gave Me a Job</div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 112, fontWeight: 900, lineHeight: 0.95, letterSpacing: -4 }}>
            <span>AI took your job.</span>
            <span>Now it&apos;s hiring.</span>
          </div>
          <div style={{ fontSize: 32, color: "#9B9E92" }}>Hold the coin. Do assignments. Get paid in SOL.</div>
        </div>
        <div
          style={{
            position: "absolute",
            right: 70,
            top: 70,
            display: "flex",
            border: "8px solid #FF5E4F",
            color: "#FF5E4F",
            fontSize: 54,
            fontWeight: 900,
            padding: "6px 22px",
            transform: "rotate(-8deg)",
          }}
        >
          NOW HIRING
        </div>
      </div>
    ),
    size
  );
}
