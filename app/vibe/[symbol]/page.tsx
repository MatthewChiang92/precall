import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { BuyButton } from "@/components/BuyButton";
import { Gauge } from "@/components/Gauge";
import { VibeChart } from "@/components/VibeChart";
import { dayLabel, fmtPct, fmtPrice, signClass } from "@/lib/format";
import { refreshAll } from "@/lib/rounds";
import { companyStories, getVibeBoard } from "@/lib/vibe";
import { FACTORS, FACTOR_LABEL, WEIGHTS, band, type Factor } from "@/lib/vibe-model";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function generateMetadata(props: PageProps<"/vibe/[symbol]">): Promise<Metadata> {
  const { symbol } = await props.params;
  return { title: `${symbol.toUpperCase()} fear & greed · PreCall` };
}

const WHY: Record<Factor, string> = {
  news: "Tone of headlines naming the company over the last three days, most recent weighted heaviest; money, deal and court stories count double.",
  momentum: "7-day on-chain price move, measured against this token's own 30-day volatility.",
  volume: "Today's on-chain volume against its 30-day average, counted in the direction of the day's move.",
  premium: "Token price over its PreStocks mark, ranked against the other companies. Recorded daily since the index started.",
};

export default async function CompanyVibe(props: PageProps<"/vibe/[symbol]">) {
  const { symbol: raw } = await props.params;
  after(() => refreshAll().catch((e) => console.error("refresh", e)));
  const v = await getVibeBoard();
  const c = v.companies.find((x) => x.symbol.toLowerCase() === raw.toLowerCase());
  if (!c) notFound();
  const stories = await companyStories(c.symbol, 3);
  const today = c.series.at(-1) ?? null;
  const score = today?.score ?? null;
  const w7 = c.series.slice(-7).map((r) => r.score).filter((x): x is number => x !== null);
  const w30 = c.series.map((r) => r.score).filter((x): x is number => x !== null);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const bull = stories.filter((s) => s.s > 0.05).length;
  const bear = stories.filter((s) => s.s < -0.05).length;

  return (
    <>
      <div className="kicker">
        <Link href="/vibe">← PreStocks fear &amp; greed</Link> · {dayLabel(v.day)}
      </div>
      <section className="vibe-grid" style={{ marginTop: 10 }}>
        <div className="panel">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {c.image ? <img src={c.image} alt="" width={38} height={38} className="logo" /> : null}
            <div>
              <div className="t-name">{c.name}</div>
              <div className="t-tick">
                {c.symbol} · {fmtPrice(c.tokenPrice)}
                {c.premium !== null && (
                  <>
                    {" "}· <span className={signClass(c.premium)}>{fmtPct(c.premium, 1)}</span> vs mark
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="gauge-wrap" style={{ marginTop: 8 }}>
            <Gauge value={score} />
            <div className="gauge-num">{score === null ? "—" : Math.round(score)}</div>
            <div className="gauge-word">{score === null ? "No coverage" : band(score).word}</div>
            <div className="bench">
              7d <b>{avg(w7) ?? "—"}</b> · 30d <b>{avg(w30) ?? "—"}</b> · {today?.factors ?? 0} of 4 factors
            </div>
          </div>
          {score === null && (
            <p className="muted" style={{ fontSize: 12.5 }}>
              No headline has named {c.name} in the last three days, so there is no score. A neutral 50 would be made up.
            </p>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <BuyButton token={{ symbol: c.symbol, name: c.name, mint: c.mint, image: c.image, url: c.url, price: c.tokenPrice, premium: c.premium }} />
            <Link href="/#slip" className="btn ghost">
              Make your call
            </Link>
          </div>
        </div>

        <div className="panel">
          <div className="kicker" style={{ marginBottom: 4 }}>What&apos;s in today&apos;s number</div>
          {FACTORS.map((k) => {
            const val = today?.[k] ?? null;
            return (
              <div className="factor" key={k}>
                <div>
                  {FACTOR_LABEL[k]} <span className="w">{WEIGHTS[k]}%</span>
                </div>
                <div className="bar">{val !== null && <span style={{ width: `${val}%`, background: band(val).color }} />}</div>
                <div className="v">{val === null ? "—" : Math.round(val)}</div>
                <div className="why">{val === null && k !== "news" ? "Not enough data for this day, so the other factors are reweighted. " : ""}{WHY[k]}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="h-section">Score over price</h2>
          <span className="kicker">30 days · on-chain daily close</span>
        </div>
        <div className="panel">
          <VibeChart
            days={v.days}
            lines={[
              { label: "Token price", color: "#8a8272", axis: "price", points: c.price.map((p) => ({ day: p.day, v: p.c })) },
              { label: "Fear & greed", color: "#16130f", axis: "score", points: c.series.map((r) => ({ day: r.day, v: r.score })) },
            ]}
            marker={v.premiumFrom ? { day: v.premiumFrom, label: "4 factors from here · 3 before" } : null}
          />
          <div className="chart-legend">
            <span>
              <i style={{ borderColor: "#16130f" }} />
              Fear &amp; greed (left, 0-100)
            </span>
            <span>
              <i style={{ borderColor: "#8a8272" }} />
              {c.name} token price (right)
            </span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="h-section">The headlines</h2>
          <span className="kicker">
            last 3 days · {stories.length} stories · <span className="up">{bull} bullish</span> ·{" "}
            <span className="down">{bear} bearish</span>
          </span>
        </div>
        {stories.length ? (
          <div className="panel">
            <ul className="stories">
              {stories.slice(0, 60).map((s) => (
                <li key={s.url}>
                  <span className={`tone ${s.s > 0.05 ? "up" : s.s < -0.05 ? "down" : "flat"}`}>
                    {s.s > 0.05 ? "BULL" : s.s < -0.05 ? "BEAR" : "NEUT"}
                  </span>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                  </a>
                  <div className="meta">
                    {s.publisher ?? "unknown"} · {new Date(s.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })} · weight {s.w}
                    {s.hits.length ? ` · ${s.hits.join(" ")}` : " · no cue words"}
                  </div>
                </li>
              ))}
            </ul>
            {stories.length > 60 && <p className="muted mono" style={{ fontSize: 11 }}>Showing the 60 newest of {stories.length}.</p>}
          </div>
        ) : (
          <div className="empty">No headlines naming {c.name} in the last three days.</div>
        )}
      </section>
    </>
  );
}
