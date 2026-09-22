import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { Change, Masthead, PAPER_NAME, Reading, Story, Trend, indexHeadline, moved } from "@/components/paper/Paper";
import { PaperGauge } from "@/components/paper/PaperGauge";
import { VibeChart } from "@/components/VibeChart";
import { refreshAll } from "@/lib/rounds";
import { getVibeBoard, marketStories, topStory } from "@/lib/vibe";
import { FACTORS, FACTOR_LABEL, WEIGHTS, band } from "@/lib/vibe-model";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const metadata: Metadata = {
  title: `${PAPER_NAME} · PreStocks fear & greed`,
  description: "A daily 0-100 fear & greed index for every PreStocks pre-IPO company, driven by the news and on-chain trading.",
};

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function FrontPage() {
  after(() => refreshAll().catch((e) => console.error("refresh", e)));
  const [v, stories] = await Promise.all([getVibeBoard(), marketStories(3)]);
  const now = v.market.at(-1) ?? null;
  const score = now?.score ?? null;
  const yesterday = v.market.at(-2)?.score ?? null;
  const weekAgo = v.market.at(-8)?.score ?? null;
  const crypto = v.crypto.at(-1)?.v ?? null;
  const name = new Map(v.companies.map((c) => [c.symbol, c.name]));

  const board = v.companies
    .map((c) => {
      const scores = v.days.map((d) => c.series.find((r) => r.day === d)?.score ?? null);
      const today = scores.at(-1) ?? null;
      const prev = scores.at(-2) ?? null;
      return {
        symbol: c.symbol,
        name: c.name,
        scores,
        today,
        prev,
        d7: avg(scores.slice(-7)),
        d30: avg(scores),
        headlines: stories.filter((s) => s.symbol === c.symbol).length,
      };
    })
    .sort((a, b) => (b.today ?? -1) - (a.today ?? -1));
  const scored = board.filter((b) => b.today !== null);

  // One story is often filed under several companies; the front page prints each headline once.
  const used = new Set<string>();
  const key = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const fresh = <T extends { title: string }>(xs: T[]) => xs.filter((s) => !used.has(key(s.title)));
  const take = <T extends { title: string }>(s: T | null) => {
    if (s) used.add(key(s.title));
    return s;
  };

  // The story moving the market most in the last two days, then the strongest from three other companies.
  const lead = take(topStory(stories.filter((s) => s.day >= v.days.at(-2)!)));
  const also = v.companies
    .filter((c) => c.symbol !== lead?.symbol)
    .map((c) => topStory(fresh(stories.filter((s) => s.symbol === c.symbol))))
    .filter((s) => s !== null)
    .sort((a, b) => b.w * Math.abs(b.s) - a.w * Math.abs(a.s))
    .slice(0, 3)
    .map((s) => take(s)!);

  const desk = board
    .filter((b) => b.headlines > 0)
    .sort((a, b) => b.headlines - a.headlines)
    .map((b) => {
      const mine = stories.filter((s) => s.symbol === b.symbol);
      const top = take(topStory(fresh(mine)) ?? topStory(mine))!;
      return { ...b, top, more: fresh(mine).slice(0, 3).map((s) => take(s)!) };
    });

  const hed = score === null ? null : indexHeadline("PreStocks index", score, yesterday);
  const deck = [
    score !== null && yesterday !== null
      ? cap(moved(score, yesterday, "yesterday")) + (weekAgo !== null ? ` and ${moved(score, weekAgo, "a week ago")}.` : ".")
      : null,
    scored.length > 1
      ? `${scored[0].name} reads hottest at ${Math.round(scored[0].today!)}; ${scored.at(-1)!.name} coldest at ${Math.round(scored.at(-1)!.today!)}.`
      : null,
    `${stories.length} headlines read in the past three days.`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <Masthead
        day={v.day}
        sections={v.companies}
        leftEar={
          <>
            <span className="k">Today&apos;s weather</span>
            <Reading score={score} />
            <span className="s">PreStocks market, 0 to 100</span>
          </>
        }
        rightEar={
          <>
            <span className="k">Crypto, for comparison</span>
            <Reading score={crypto} />
            <span className="s">alternative.me fear &amp; greed</span>
          </>
        }
      />

      <section className="np-banner">
        <div className="np-kicker">{hed?.kicker ?? "Awaiting the news"}</div>
        <h1 className="np-banner-hed">{hed?.head ?? "No PreStocks company has made the news in three days"}</h1>
        <p className="np-deck">{deck}</p>
      </section>

      <section className="np-grid np-above">
        <div className="np-col span-7">
          <figure className="np-gauge">
            <div className="np-box-title">The PreStocks Fear &amp; Greed Index</div>
            <PaperGauge value={score} />
            <div className="np-gauge-read">
              <span className="n">{score === null ? "—" : Math.round(score)}</span>
              <span className="w">{score === null ? "No reading" : band(score).word}</span>
            </div>
            <figcaption>
              The mean of the {now?.factors ?? 0} companies with a reading today
              {yesterday !== null && <>; yesterday {Math.round(yesterday)}</>}
              {weekAgo !== null && <>, a week ago {Math.round(weekAgo)}</>}. Zero is extreme fear, 100 extreme greed.
            </figcaption>
          </figure>

          <div className="np-grid np-under-gauge">
            <div className="np-col span-6">
              <h2 className="np-rubric">The formula</h2>
              <table className="np-table np-formula">
                <tbody>
                  {FACTORS.map((k) => {
                    const val = now?.[k] ?? null;
                    return (
                      <tr key={k}>
                        <td>{FACTOR_LABEL[k]}</td>
                        <td className="num w">{WEIGHTS[k]}%</td>
                        <td className="np-bar">{val !== null && <span style={{ width: `${val}%` }} />}</td>
                        <td className="num">{val === null ? "—" : Math.round(val)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="np-note">Market average of each factor today. News is required: a company with no headline in three days gets no score.</p>
            </div>
            <div className="np-col span-6">
              <h2 className="np-rubric">About the index</h2>
              <p className="np-body np-dropcap">
                Every PreStocks company is scored from 0 to 100 each day. It moves with the news: each headline naming a company is
                read and scored, then combined with the token&apos;s on-chain momentum, volume and premium to its PreStocks mark.
                Players never feed it. <Link href="/how#index">How it is built</Link>.
              </p>
            </div>
          </div>
        </div>

        <div className="np-col span-5">
          {lead ? (
            <Story story={lead} size="lead" kicker={<>Moving the market · {name.get(lead.symbol) ?? lead.symbol}</>} cues />
          ) : (
            <p className="np-note">No headline in the last two days.</p>
          )}
          {also.map((s) => (
            <Story key={s.url} story={s} size="main" kicker={name.get(s.symbol) ?? s.symbol} />
          ))}
        </div>
      </section>

      <section className="np-section">
        <h2 className="np-section-head">
          The board <span>every company, highest reading first · tap for its section</span>
        </h2>
        <div className="np-table-wrap">
          <table className="np-table np-board">
            <thead>
              <tr>
                <th>Company</th>
                <th className="num">Today</th>
                <th>Reading</th>
                <th className="num">Chg</th>
                <th className="num">7-day</th>
                <th className="num">30-day</th>
                <th>Last 30 days</th>
                <th className="num">Headlines, 3d</th>
              </tr>
            </thead>
            <tbody>
              {board.map((b) => (
                <tr key={b.symbol}>
                  <td className="co">
                    <Link href={`/vibe/${b.symbol.toLowerCase()}`}>{b.name}</Link>
                  </td>
                  <td className="num big">{b.today === null ? "—" : Math.round(b.today)}</td>
                  <td className="word">{b.today === null ? "no coverage" : band(b.today).word}</td>
                  <td className="num">
                    <Change now={b.today} then={b.prev} />
                  </td>
                  <td className="num">{b.d7 === null ? "—" : Math.round(b.d7)}</td>
                  <td className="num">{b.d30 === null ? "—" : Math.round(b.d30)}</td>
                  <td>
                    <Trend xs={b.scores} />
                  </td>
                  <td className="num">{b.headlines}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {desk.length > 0 && (
        <section className="np-section">
          <h2 className="np-section-head">
            News from every desk <span>the strongest story per company, then the latest</span>
          </h2>
          <div className="np-desks">
            {desk.map((d) => (
              <div key={d.symbol} className="np-desk">
                <div className="np-desk-flag">
                  <Link href={`/vibe/${d.symbol.toLowerCase()}`}>{d.name}</Link>
                  <Reading score={d.today} />
                </div>
                <Story story={d.top} size="main" />
                {d.more.map((s) => (
                  <Story key={s.url} story={s} />
                ))}
                <Link className="np-jump" href={`/vibe/${d.symbol.toLowerCase()}`}>
                  Continued in the {d.name} section · {d.headlines} stories →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="np-section">
        <h2 className="np-section-head">
          Thirty days <span>PreStocks against crypto</span>
        </h2>
        <figure className="np-figure">
          <VibeChart
            days={v.days}
            lines={[
              { label: "Crypto fear & greed", color: "var(--np-ink-3)", dash: "5 4", axis: "score", points: v.crypto.map((c) => ({ day: c.day, v: c.v })) },
              { label: "PreStocks fear & greed", color: "var(--np-ink)", axis: "score", points: v.market.map((r) => ({ day: r.day, v: r.score })) },
            ]}
            marker={v.premiumFrom ? { day: v.premiumFrom, label: "premium factor starts" } : null}
          />
          <figcaption>
            <b>Solid:</b> the PreStocks index, the mean of the companies scored that day. <b>Dashed:</b> crypto fear &amp; greed from
            alternative.me. Shaded bands are extreme fear (below 25) and extreme greed (above 75).
          </figcaption>
        </figure>
      </section>
    </>
  );
}
