import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { Gauge } from "@/components/Gauge";
import { VibeChart } from "@/components/VibeChart";
import { VibeTable } from "@/components/VibeTable";
import { dayLabel } from "@/lib/format";
import { refreshAll } from "@/lib/rounds";
import { getVibeBoard } from "@/lib/vibe";
import { FACTORS, FACTOR_LABEL, WEIGHTS, band } from "@/lib/vibe-model";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const metadata: Metadata = {
  title: "PreStocks Fear & Greed · PreCall",
  description: "A daily 0-100 fear & greed index for every PreStocks pre-IPO company, driven by news sentiment and on-chain trading.",
};

export default async function VibePage() {
  after(() => refreshAll().catch((e) => console.error("refresh", e)));
  const v = await getVibeBoard();
  const now = v.market.at(-1) ?? null;
  const score = now?.score ?? null;
  const yesterday = v.market.at(-2)?.score ?? null;
  const crypto = v.crypto.at(-1)?.v ?? null;

  return (
    <>
      <section className="hero">
        <div>
          <div className="kicker">Index · {dayLabel(v.day)} · updates through the day</div>
          <h1 className="h-display">
            PreStocks <span className="hl">fear &amp; greed</span>
          </h1>
          <p className="hero-lede">
            How the market feels about OpenAI, Anthropic, SpaceX and every other PreStocks company, scored <b>0 to 100</b> each
            day. It moves with the <b>news</b>: every headline naming a company is read and scored, then combined with the
            token&apos;s on-chain momentum, volume and premium to its PreStocks mark. No player input.
          </p>
          <p className="hero-lede" style={{ fontSize: 14 }}>
            Read it, then <Link href="/#slip">make your calls</Link>. <Link href="/how#index">How the score is built →</Link>
          </p>
        </div>
        <div className="panel">
          <div className="kicker">PreStocks market · today</div>
          <div className="gauge-wrap">
            <Gauge value={score} />
            <div className="gauge-num">{score === null ? "—" : Math.round(score)}</div>
            <div className="gauge-word">{score === null ? "Reading the news…" : band(score).word}</div>
            <div className="bench">
              {yesterday !== null && score !== null && (
                <>
                  yesterday <b>{Math.round(yesterday)}</b> ·{" "}
                </>
              )}
              {crypto !== null && (
                <>
                  crypto fear &amp; greed <b>{Math.round(crypto)}</b> ·{" "}
                </>
              )}
              {now?.stories ?? 0} headlines today
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            {FACTORS.map((k) => {
              const val = now?.[k] ?? null;
              return (
                <div className="factor" key={k} style={{ gridTemplateColumns: "130px 1fr 34px" }}>
                  <div>
                    {FACTOR_LABEL[k]} <span className="w">{WEIGHTS[k]}%</span>
                  </div>
                  <div className="bar">
                    {val !== null && <span style={{ width: `${val}%`, background: band(val).color }} />}
                  </div>
                  <div className="v">{val === null ? "—" : Math.round(val)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="h-section">Last 30 days</h2>
          <span className="kicker">PreStocks market vs crypto</span>
        </div>
        <div className="panel">
          <VibeChart
            days={v.days}
            lines={[
              { label: "Crypto fear & greed", color: "#8a8272", dash: "5 4", axis: "score", points: v.crypto.map((c) => ({ day: c.day, v: c.v })) },
              { label: "PreStocks fear & greed", color: "#16130f", axis: "score", points: v.market.map((r) => ({ day: r.day, v: r.score })) },
            ]}
            marker={v.premiumFrom ? { day: v.premiumFrom, label: "premium factor starts" } : null}
          />
          <div className="chart-legend">
            <span>
              <i style={{ borderColor: "#16130f" }} />
              PreStocks fear &amp; greed (mean of the companies scored that day)
            </span>
            <span>
              <i style={{ borderColor: "#8a8272", borderTopStyle: "dashed" }} />
              Crypto fear &amp; greed (alternative.me)
            </span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="h-section">Every company</h2>
          <span className="kicker">tap a row for the headlines behind it</span>
        </div>
        <VibeTable
          rows={v.companies.map((c) => ({
            symbol: c.symbol,
            name: c.name,
            image: c.image,
            scores: v.days.map((d) => c.series.find((r) => r.day === d)?.score ?? null),
            stories: v.days.map((d) => c.series.find((r) => r.day === d)?.stories ?? 0),
          }))}
        />
      </section>
    </>
  );
}
