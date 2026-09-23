import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { listTokens } from "@/lib/prestocks";

export const alt = "PreCall: call next week's pre-IPO market. Weekly UP/DOWN calls on PreStocks tokens, settled on Solana.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

const bold = readFile(join(process.cwd(), "assets/fonts/Inter-700.woff"));
const medium = readFile(join(process.cwd(), "assets/fonts/Inter-500.woff"));

// PreStocks palette (see globals.css)
const NAVY = "#14154f";
const BRAND = "#6264d9";
const GREY = "#6a7271";
const SURFACE = "#f7f8fa";
const LINE = "#e1e6ea";
const UP = "#16a34a";
const DOWN = "#eb5757";

const Tri = ({ up }: { up: boolean }) => (
  <svg width="18" height="16" viewBox="0 0 18 16">
    <path d={up ? "M9 1L17 15H1Z" : "M9 15L1 1H17Z"} fill={up ? UP : DOWN} />
  </svg>
);

export default async function Image() {
  let names = ["OpenAI", "Anthropic", "SpaceX", "Anduril", "Kalshi", "Polymarket", "Neuralink", "Figure AI"];
  try {
    const t = await listTokens();
    if (t.length) names = t.map((x) => x.name);
  } catch {}

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#fff", color: NAVY, fontFamily: "Inter" }}>
        <div style={{ display: "flex", height: 10, background: `linear-gradient(to right, rgba(98, 100, 217, 0.9), ${BRAND})` }} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "44px 64px 48px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <svg width="56" height="56" viewBox="0 0 32 32">
                <rect width="32" height="32" rx="9" fill={BRAND} />
                <path d="M8 21.5l5.5-5.5 4 4L24 13.5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M19.5 13.5H24V18" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div style={{ fontSize: 46, fontWeight: 700, letterSpacing: -1 }}>PreCall</div>
            </div>
            <div style={{ display: "flex", fontSize: 22, fontWeight: 500, color: BRAND, background: "#edeef2", borderRadius: 999, padding: "10px 22px" }}>
              The weekly pre-IPO call · on Solana
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 40, fontSize: 88, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2.5 }}>
            <div style={{ display: "flex" }}>Call next week&apos;s</div>
            <div style={{ display: "flex" }}>
              <span style={{ color: BRAND }}>pre-IPO</span>
              <span style={{ marginLeft: 24 }}>market.</span>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 34 }}>
            {names.slice(0, 10).map((n) => (
              <div
                key={n}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  border: `2px solid ${LINE}`,
                  borderRadius: 999,
                  padding: "8px 18px",
                  background: SURFACE,
                  fontSize: 26,
                  fontWeight: 700,
                }}
              >
                <span>{n}</span>
                <Tri up />
                <Tri up={false} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", marginTop: "auto", fontSize: 22, fontWeight: 500, color: GREY }}>
            UP or DOWN on every PreStocks token · locks Monday 00:00 UTC · settled on-chain · free
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter", data: await bold, weight: 700, style: "normal" },
        { name: "Inter", data: await medium, weight: 500, style: "normal" },
      ],
    },
  );
}
