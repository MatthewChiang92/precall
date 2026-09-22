import "server-only";
import { claim, markFetch, sql } from "./db";
import { readNews } from "./news";
import { tone } from "./news/lexicon";
import { listTokens } from "./prestocks";
import { readBars } from "./prices";
import { DAY_MS, HOUR_MS, addDays, dayOf, dayStart } from "./time";
import { type Factor, NEWS_GAIN, NEWS_RECENCY, cdf100, combine } from "./vibe-model";

/** Days of index the site shows (1d / 7d / 30d windows). */
export const VIBE_DAYS = 30;

export interface VibeRow {
  day: string;
  symbol: string;
  score: number | null;
  news: number | null;
  momentum: number | null;
  volume: number | null;
  premium: number | null;
  stories: number;
  tone: number | null;
  factors: number;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const std = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

/** Snapshot today's PreStocks mark and token price (the API only knows "now"). */
async function snapshotMarks(now: number) {
  const day = dayOf(now);
  await sql`
    insert into marks_daily (day, symbol, mark_price, token_price)
    select ${day}::date, symbol, mark_price, token_price from tokens
    where last_seen > now() - interval '1 day' and mark_price > 0 and token_price > 0
    on conflict (day, symbol) do update set mark_price = excluded.mark_price, token_price = excluded.token_price`;
}

/**
 * Recompute the last VIBE_DAYS days for every company and the market. Cheap
 * (reads only our own tables), so it simply overwrites: a lexicon change or a
 * late-arriving story is reflected everywhere on the next run.
 */
export async function computeVibe(now = Date.now()): Promise<number> {
  await snapshotMarks(now);
  const today = dayOf(now);
  const days: string[] = [];
  for (let i = VIBE_DAYS - 1; i >= 0; i--) days.push(addDays(today, -i));
  const tokens = await listTokens();
  const stories = await readNews(addDays(days[0], -NEWS_RECENCY.length));
  const marks = await sql`select day::text as day, symbol, mark_price, token_price from marks_daily where day >= ${days[0]}::date`;

  // Premium rank across companies, per day.
  const premiumRank = new Map<string, number>();
  for (const d of days) {
    const ps = marks
      .filter((m) => m.day === d)
      .map((m) => ({ s: m.symbol as string, p: m.token_price / m.mark_price - 1 }))
      .sort((a, b) => a.p - b.p);
    if (ps.length < 3) continue;
    ps.forEach((x, i) => premiumRank.set(`${d}|${x.s}`, (i / (ps.length - 1)) * 100));
  }

  // Tone per story, grouped by company and day.
  const byKey = new Map<string, { s: number; w: number }[]>();
  for (const st of stories) {
    const t = tone(st.title);
    const k = `${st.symbol}|${st.day}`;
    const arr = byKey.get(k) ?? [];
    arr.push({ s: t.s, w: t.w });
    byKey.set(k, arr);
  }

  const rows: VibeRow[] = [];
  for (const tk of tokens) {
    const { bars } = await readBars(tk.mint, "1d", dayStart(days[0]) - 45 * DAY_MS);
    // Close and volume per calendar day; a day with no bar carries the last close, zero volume.
    const close = new Map<string, number>();
    const vol = new Map<string, number>();
    for (const b of bars) {
      close.set(dayOf(b.t), b.c);
      vol.set(dayOf(b.t), b.v ?? 0);
    }
    const first = bars.length ? dayOf(bars[0].t) : null;
    const closeOn = (d: string): number | null => {
      if (!first || d < first) return null;
      for (let x = d; x >= first; x = addDays(x, -1)) if (close.has(x)) return close.get(x)!;
      return null;
    };

    for (const d of days) {
      const f: Record<Factor, number | null> = { news: null, momentum: null, volume: null, premium: null };

      // News: materiality-weighted tone over the last three days, most recent heaviest.
      let num = 0;
      let den = 0;
      let dayCount = 0;
      let dayTone = 0;
      let dayW = 0;
      NEWS_RECENCY.forEach((r, i) => {
        for (const x of byKey.get(`${tk.symbol}|${addDays(d, -i)}`) ?? []) {
          num += r * x.w * x.s;
          den += r * x.w;
          if (i === 0) {
            dayCount++;
            dayTone += x.w * x.s;
            dayW += x.w;
          }
        }
      });
      if (den > 0) f.news = 50 + 50 * Math.tanh(NEWS_GAIN * (num / den));

      // Momentum: 7-day log return in units of this token's own 30-day daily volatility.
      const c = closeOn(d);
      const c7 = closeOn(addDays(d, -7));
      const rets: number[] = [];
      for (let i = 0; i < 30; i++) {
        const a = closeOn(addDays(d, -i - 1));
        const b = closeOn(addDays(d, -i));
        if (a && b) rets.push(Math.log(b / a));
      }
      const sigma = std(rets);
      if (c && c7 && rets.length >= 10 && sigma > 0) f.momentum = cdf100(Math.log(c / c7) / (sigma * Math.sqrt(7)));

      // Volume: heavy trading counts in the direction of the day's move; quiet trading reads neutral.
      const prior: number[] = [];
      for (let i = 1; i <= 30; i++) {
        const x = addDays(d, -i);
        if (first && x >= first) prior.push(vol.get(x) ?? 0);
      }
      const avg = mean(prior);
      let v = vol.get(d) ?? 0;
      const elapsed = d === today ? (now - dayStart(d)) / HOUR_MS : 24;
      const c1 = closeOn(addDays(d, -1));
      if (prior.length >= 7 && avg > 0 && elapsed >= 6 && c && c1) {
        v *= 24 / elapsed; // today's partial volume, at the pace so far
        const heavy = (Math.tanh(Math.log(Math.max(v, 1) / avg)) + 1) / 2; // 0 quiet .. 1 heavy
        const move = c / c1 - 1;
        const dir = Math.abs(move) < 1e-4 ? 0 : Math.sign(move);
        f.volume = 50 + 50 * dir * heavy;
      }

      f.premium = premiumRank.get(`${d}|${tk.symbol}`) ?? null;

      const { score, factors } = combine(f);
      rows.push({
        day: d,
        symbol: tk.symbol,
        score,
        ...f,
        stories: dayCount,
        tone: dayW ? dayTone / dayW : null,
        factors,
      });
    }
  }

  // The PreStocks market: mean of the companies that have a score that day.
  for (const d of days) {
    const rs = rows.filter((r) => r.day === d && r.symbol !== "_ALL");
    const avgOf = (k: keyof VibeRow) => {
      const xs = rs.map((r) => r[k]).filter((x): x is number => typeof x === "number" && Number.isFinite(x));
      return xs.length ? mean(xs) : null;
    };
    const scored = rs.filter((r) => r.score !== null);
    rows.push({
      day: d,
      symbol: "_ALL",
      score: scored.length ? mean(scored.map((r) => r.score!)) : null,
      news: avgOf("news"),
      momentum: avgOf("momentum"),
      volume: avgOf("volume"),
      premium: avgOf("premium"),
      stories: rs.reduce((a, r) => a + r.stories, 0),
      tone: avgOf("tone"),
      factors: scored.length,
    });
  }

  const col = <K extends keyof VibeRow>(k: K) => rows.map((r) => r[k]);
  await sql`
    insert into vibe_daily (day, symbol, score, news, momentum, volume, premium, stories, tone, factors, computed_at)
    select x.day::date, x.symbol, x.score, x.news, x.momentum, x.volume, x.premium, x.stories, x.tone, x.factors, now()
    from unnest(${col("day")}::text[], ${col("symbol")}::text[], ${col("score")}::float8[], ${col("news")}::float8[],
                ${col("momentum")}::float8[], ${col("volume")}::float8[], ${col("premium")}::float8[],
                ${col("stories")}::int[], ${col("tone")}::float8[], ${col("factors")}::int[])
         as x(day, symbol, score, news, momentum, volume, premium, stories, tone, factors)
    on conflict (day, symbol) do update set
      score = excluded.score, news = excluded.news, momentum = excluded.momentum, volume = excluded.volume,
      premium = excluded.premium, stories = excluded.stories, tone = excluded.tone, factors = excluded.factors,
      computed_at = now()`;
  return rows.length;
}

/** Crypto Fear & Greed (alternative.me), stored beside ours as '_CRYPTO' for the benchmark line. */
async function refreshCrypto() {
  if (!(await claim("crypto-fng", 3 * 3600))) return;
  try {
    const r = await fetch("https://api.alternative.me/fng/?limit=45", { cache: "no-store", signal: AbortSignal.timeout(8000) });
    const j = (await r.json()) as { data?: { value: string; timestamp: string }[] };
    const data = (j.data ?? []).filter((x) => Number.isFinite(Number(x.value)));
    if (!data.length) throw new Error("fng: empty");
    await sql`
      insert into vibe_daily (day, symbol, score, factors)
      select to_timestamp(x.ts)::date, '_CRYPTO', x.v, 1
      from unnest(${data.map((x) => Number(x.timestamp))}::float8[], ${data.map((x) => Number(x.value))}::float8[]) as x(ts, v)
      on conflict (day, symbol) do update set score = excluded.score, computed_at = now()`;
    await markFetch("crypto-fng", true, `${data.length}`);
  } catch (e) {
    await markFetch("crypto-fng", false, String(e).slice(0, 300));
  }
}

/** Throttled: recompute at most every 10 minutes. */
export async function refreshVibe(now = Date.now(), force = false) {
  await refreshCrypto();
  if (!(await claim("vibe", force ? 0 : 600))) return;
  try {
    const n = await computeVibe(now);
    await markFetch("vibe", true, `${n} rows`);
  } catch (e) {
    await markFetch("vibe", false, String(e).slice(0, 500));
    throw e;
  }
}

export async function readVibe(sinceDay: string): Promise<VibeRow[]> {
  const rows = await sql`
    select day::text as day, symbol, score, news, momentum, volume, premium, stories, tone, factors
    from vibe_daily where day >= ${sinceDay}::date order by day`;
  return rows as VibeRow[];
}

export interface ToneStory {
  title: string;
  url: string;
  publisher: string | null;
  publishedAt: number;
  day: string;
  s: number;
  w: number;
  hits: string[];
}

export function scoreStory(st: { title: string; url: string; publisher: string | null; publishedAt: number; day: string }): ToneStory {
  const t = tone(st.title);
  return { title: st.title, url: st.url, publisher: st.publisher, publishedAt: st.publishedAt, day: st.day, s: t.s, w: t.w, hits: t.hits };
}

/** The story that moved a company most in the window (most material, strongest tone, newest). */
function topStory(xs: ToneStory[]): ToneStory | null {
  if (!xs.length) return null;
  return [...xs].sort((a, b) => b.w * Math.abs(b.s) - a.w * Math.abs(a.s) || b.publishedAt - a.publishedAt)[0];
}

export interface VibeSummary {
  day: string;
  market: { now: VibeRow | null; yesterday: number | null; weekAgo: number | null };
  crypto: number | null;
  bySymbol: Record<string, { now: VibeRow | null; yesterday: number | null; top: ToneStory | null; stories3d: number }>;
  /** The headline moving the market most right now, with its company. */
  lead: (ToneStory & { symbol: string }) | null;
}

export async function getVibeSummary(now = Date.now()): Promise<VibeSummary> {
  const today = dayOf(now);
  // Same three-day window the news factor uses.
  const [rows, stories] = await Promise.all([readVibe(addDays(today, -8)), readNews(addDays(today, -(NEWS_RECENCY.length - 1)))]);
  const at = (sym: string, d: string) => rows.find((r) => r.symbol === sym && r.day === d) ?? null;
  const latest = (sym: string) => at(sym, today) ?? at(sym, addDays(today, -1));
  const crypto = at("_CRYPTO", today)?.score ?? at("_CRYPTO", addDays(today, -1))?.score ?? null;
  const bySymbol: VibeSummary["bySymbol"] = {};
  for (const sym of new Set(rows.map((r) => r.symbol))) {
    if (sym.startsWith("_")) continue;
    const mine = stories.filter((s) => s.symbol === sym).map(scoreStory);
    bySymbol[sym] = { now: latest(sym), yesterday: at(sym, addDays(today, -1))?.score ?? null, top: topStory(mine), stories3d: mine.length };
  }
  const recent = stories.filter((s) => s.day >= addDays(today, -1)).map((s) => ({ ...scoreStory(s), symbol: s.symbol }));
  const lead = (topStory(recent) as (ToneStory & { symbol: string }) | null) ?? null;
  return {
    day: today,
    market: { now: latest("_ALL"), yesterday: at("_ALL", addDays(today, -1))?.score ?? null, weekAgo: at("_ALL", addDays(today, -7))?.score ?? null },
    crypto,
    bySymbol,
    lead: lead && lead.s !== 0 ? lead : null,
  };
}

export interface VibeCompany {
  symbol: string;
  name: string;
  mint: string;
  image: string | null;
  url: string | null;
  tokenPrice: number | null;
  premium: number | null;
  /** Oldest first, one entry per day in the window (score may be null). */
  series: VibeRow[];
  /** Daily on-chain closes over the window, oldest first. */
  price: { day: string; c: number }[];
}

export interface VibeBoard {
  day: string;
  days: string[];
  market: VibeRow[];
  crypto: { day: string; v: number }[];
  companies: VibeCompany[];
  /** First day the premium factor exists (first marks snapshot). */
  premiumFrom: string | null;
}

export async function getVibeBoard(now = Date.now()): Promise<VibeBoard> {
  const today = dayOf(now);
  const from = addDays(today, -(VIBE_DAYS - 1));
  const days: string[] = [];
  for (let d = from; d <= today; d = addDays(d, 1)) days.push(d);
  const [rows, tokens, firstMark] = await Promise.all([
    readVibe(from),
    listTokens(),
    sql`select min(day)::text as d from marks_daily`,
  ]);
  const companies = await Promise.all(
    tokens.map(async (t) => {
      const { bars } = await readBars(t.mint, "1d", dayStart(from));
      return {
        symbol: t.symbol,
        name: t.name,
        mint: t.mint,
        image: t.image,
        url: t.url,
        tokenPrice: t.tokenPrice,
        premium: t.markPrice && t.tokenPrice ? t.tokenPrice / t.markPrice - 1 : null,
        series: rows.filter((r) => r.symbol === t.symbol),
        price: bars.map((b) => ({ day: dayOf(b.t), c: b.c })),
      };
    }),
  );
  return {
    day: today,
    days,
    market: rows.filter((r) => r.symbol === "_ALL"),
    crypto: rows.filter((r) => r.symbol === "_CRYPTO" && r.score !== null).map((r) => ({ day: r.day, v: r.score! })),
    companies,
    premiumFrom: firstMark[0]?.d ?? null,
  };
}

/** Stories for one company over the last `days` days, scored, newest first. */
export async function companyStories(symbol: string, days = 3, now = Date.now()): Promise<ToneStory[]> {
  const xs = await readNews(addDays(dayOf(now), -(days - 1)), symbol);
  return xs.map(scoreStory);
}
