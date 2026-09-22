import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { BuyButton } from "@/components/BuyButton";
import { Masthead, PAPER_NAME, Photo, Reading, Story, indexHeadline, moved } from "@/components/paper/Paper";
import { PaperGauge } from "@/components/paper/PaperGauge";
import { VibeChart } from "@/components/VibeChart";
import { fmtPct, fmtPrice } from "@/lib/format";
import { refreshAll } from "@/lib/rounds";
import { companyStories, getVibeBoard, topStory } from "@/lib/vibe";
import { FACTORS, FACTOR_LABEL, WEIGHTS, band, type Factor } from "@/lib/vibe-model";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function generateMetadata(props: PageProps<"/vibe/[symbol]">): Promise<Metadata> {
  const { symbol } = await props.params;
  return { title: `${symbol.toUpperCase()} · ${PAPER_NAME}` };
}

const WHY: Record<Factor, string> = {
  news: "Tone of headlines naming the company over the last three days, most recent weighted heaviest; money, deal and court stories count double.",
  momentum: "7-day on-chain price move, measured against this token's own 30-day volatility.",
  volume: "Today's on-chain volume against its 30-day average, counted in the direction of the day's move.",
  premium: "Token price over its PreStocks mark, ranked against the other companies. Recorded daily since the index started.",
};

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function Section(props: PageProps<"/vibe/[symbol]">) {
  const { symbol: raw } = await props.params;
  after(() => refreshAll().catch((e) => console.error("refresh", e)));
  const v = await getVibeBoard();
  const c = v.companies.find((x) => x.symbol.toLowerCase() === raw.toLowerCase());
  if (!c) notFound();
  const stories = await companyStories(c.symbol, 3);
  const today = c.series.at(-1) ?? null;
  const score = today?.score ?? null;
  const yesterday = c.series.at(-2)?.score ?? null;
  const market = v.market.at(-1)?.score ?? null;
  const d7 = avg(c.series.slice(-7).map((r) => r.score));
  const d30 = avg(c.series.map((r) => r.score));
  const bull = stories.filter((s) => s.s > 0.05).length;
  const bear = stories.filter((s) => s.s < -0.05).length;

  const lead = topStory(stories);
  const rest = stories.filter((s) => s !== lead);
  const hed = score === null ? null : indexHeadline(c.name, score, yesterday);
  const deck = [
    score !== null && yesterday !== null ? `${cap(moved(score, yesterday, "yesterday"))}.` : null,
    d7 !== null ? `7-day average ${d7}, 30-day ${d30}.` : null,
    `${stories.length} headline${stories.length === 1 ? "" : "s"} in three days: ${bull} bullish, ${bear} bearish.`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <Masthead
        day={v.day}
        sections={v.companies}
        current={c.symbol}
        leftEar={
          <>
            <span className="k">{c.name} today</span>
            <Reading score={score} />
            <span className="s">{today?.factors ?? 0} of 4 factors</span>
          </>
        }
        rightEar={
          <>
            <span className="k">Whole market</span>
            <Reading score={market} />
            <span className="s">
              <Link href="/vibe">Front page →</Link>
            </span>
          </>
        }
      />

      <section className="np-flag">
        {c.image && <Photo src={c.image} alt="" className="np-flag-logo" />}
        <div className="np-flag-name">
          <span className="np-kicker">Company section</span>
          <h1>{c.name}</h1>
        </div>
        <div className="np-flag-quote">
          <div>
            <b>{c.symbol}</b> {fmtPrice(c.tokenPrice)}
            {c.premium !== null && <> · {fmtPct(c.premium, 1)} vs PreStocks mark</>}
          </div>
          <div className="np-flag-actions">
            <BuyButton
              className="np-btn"
              label={`Buy ${c.symbol}`}
              token={{ symbol: c.symbol, name: c.name, mint: c.mint, image: c.image, url: c.url, price: c.tokenPrice, premium: c.premium }}
            />
            <Link href="/#slip" className="np-btn ghost">
              Make your call
            </Link>
          </div>
        </div>
      </section>

      <section className="np-banner">
        <div className="np-kicker">{hed?.kicker ?? "No coverage"}</div>
        <h1 className="np-banner-hed sm">{hed?.head ?? `No headlines, no score for ${c.name}`}</h1>
        <p className="np-deck">
          {score === null
            ? `No headline has named ${c.name} in the last three days, so there is no reading today. A neutral 50 would be made up.`
            : deck}
        </p>
      </section>

      <section className="np-grid np-above">
        <div className="np-col span-5">
          <figure className="np-gauge">
            <div className="np-box-title">{c.name} fear &amp; greed</div>
            <PaperGauge value={score} />
            <div className="np-gauge-read">
              <span className="n">{score === null ? "—" : Math.round(score)}</span>
              <span className="w">{score === null ? "No reading" : band(score).word}</span>
            </div>
            <figcaption>
              {yesterday !== null ? <>Yesterday {Math.round(yesterday)}. </> : null}
              {market !== null ? <>The whole PreStocks market reads {Math.round(market)}.</> : null}
            </figcaption>
          </figure>

          <h2 className="np-rubric">What&apos;s in the number</h2>
          <table className="np-table np-formula">
            <tbody>
              {FACTORS.map((k) => {
                const val = today?.[k] ?? null;
                return (
                  <tr key={k}>
                    <td>
                      {FACTOR_LABEL[k]}
                      <div className="why">
                        {val === null && k !== "news" ? "No data today, so the other factors are reweighted. " : ""}
                        {WHY[k]}
                      </div>
                    </td>
                    <td className="num w">{WEIGHTS[k]}%</td>
                    <td className="np-bar">{val !== null && <span style={{ width: `${val}%` }} />}</td>
                    <td className="num">{val === null ? "—" : Math.round(val)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="np-col span-7">
          {lead ? (
            <>
              <Story story={lead} size="lead" kicker="The story moving it most" cues />
              <div className="np-columns">
                {rest.slice(0, 10).map((s) => (
                  <Story key={s.url} story={s} cues />
                ))}
              </div>
            </>
          ) : (
            <p className="np-note">No headlines naming {c.name} in the last three days.</p>
          )}
        </div>
      </section>

      <section className="np-section">
        <h2 className="np-section-head">
          Score over price <span>30 days · on-chain daily close</span>
        </h2>
        <figure className="np-figure">
          <VibeChart
            days={v.days}
            lines={[
              { label: "Token price", color: "var(--np-ink-3)", dash: "5 4", axis: "price", points: c.price.map((p) => ({ day: p.day, v: p.c })) },
              { label: "Fear & greed", color: "var(--np-ink)", axis: "score", points: c.series.map((r) => ({ day: r.day, v: r.score })) },
            ]}
            marker={v.premiumFrom ? { day: v.premiumFrom, label: "4 factors from here · 3 before" } : null}
          />
          <figcaption>
            <b>Solid:</b> {c.name} fear &amp; greed, 0 to 100 on the left scale. <b>Dashed:</b> its PreStocks token&apos;s daily
            on-chain close, on the right.
          </figcaption>
        </figure>
      </section>

      {rest.length > 10 && (
        <section className="np-section">
          <h2 className="np-section-head">
            All the coverage <span>last three days, newest first</span>
          </h2>
          <div className="np-columns wide">
            {rest.slice(10, 70).map((s) => (
              <Story key={s.url} story={s} cues />
            ))}
          </div>
          {rest.length > 70 && <p className="np-note">Showing 71 of {stories.length} stories.</p>}
        </section>
      )}
    </>
  );
}
