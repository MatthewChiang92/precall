import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { listTokens } from "@/lib/prestocks";

export const alt = "PreCall: call next week's pre-IPO market. Weekly UP/DOWN calls on PreStocks tokens, settled on Solana.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

const display = readFile(join(process.cwd(), "assets/fonts/BigShoulders-900.ttf"));
const mono = readFile(join(process.cwd(), "assets/fonts/IBMPlexMono-500.ttf"));

const INK = "#16130f";
const PAPER = "#f1ebdd";
const HI = "#f3d43b";
const UP = "#0b7a45";
const DOWN = "#c2321c";

export default async function Image() {
  let names = ["OpenAI", "Anthropic", "SpaceX", "Anduril", "Kalshi", "Polymarket", "Neuralink", "Figure AI"];
  try {
    const t = await listTokens();
    if (t.length) names = t.map((x) => x.name);
  } catch {}

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: PAPER, color: INK, padding: "52px 64px", fontFamily: "Mono" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `5px solid ${INK}`, paddingBottom: 14 }}>
          <div style={{ fontFamily: "Display", fontSize: 64, letterSpacing: 1 }}>PRECALL</div>
          <div style={{ fontSize: 22, letterSpacing: 3 }}>THE WEEKLY PRE-IPO CALL · ON SOLANA</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 26, fontFamily: "Display", fontSize: 108, lineHeight: 0.9 }}>
          <div style={{ display: "flex" }}>CALL NEXT WEEK&apos;S</div>
          <div style={{ display: "flex" }}>
            <span style={{ background: HI, padding: "0 10px" }}>PRE-IPO</span>
            <span style={{ marginLeft: 26 }}>MARKET.</span>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 28 }}>
          {names.slice(0, 10).map((n) => (
            <div
              key={n}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                border: `3px solid ${INK}`,
                borderRadius: 6,
                padding: "6px 14px",
                background: "#fbf8f1",
                fontFamily: "Display",
                fontSize: 30,
              }}
            >
              <span>{n.toUpperCase()}</span>
              <span style={{ color: UP, fontSize: 24 }}>▲</span>
              <span style={{ color: DOWN, fontSize: 24, marginLeft: -4 }}>▼</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", marginTop: "auto", fontSize: 22 }}>
          UP or DOWN on every PreStocks token · locks Monday 00:00 UTC · settled on-chain · free
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Display", data: await display, weight: 900, style: "normal" },
        { name: "Mono", data: await mono, weight: 500, style: "normal" },
      ],
    },
  );
}
