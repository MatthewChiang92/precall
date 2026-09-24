import "server-only";
import { createHash } from "node:crypto";
import { claim, markFetch, releaseClaim, sql } from "./db";
import { headlineMatches, isSpam, profileFor } from "./news/companies";
import { listTokens } from "./prestocks";
import { DAY_MS, addDays, dayOf, dayStart } from "./time";

/** Days of news the index keeps filled. */
export const NEWS_DAYS = 45;
/** Today's window is re-read this often. */
const LIVE_REFRESH_SEC = 20 * 60;
const SPACING_MS = 700;
const LOCK_SEC = 290;

export interface Story {
  symbol: string;
  day: string;
  publishedAt: number;
  title: string;
  publisher: string | null;
  url: string;
}

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
    .trim();

/**
 * One Google News RSS query over [from, to). Google's day boundaries are US Pacific,
 * so a window returns a little either side; each story is filed by the UTC date of
 * its own publish time, and overlapping windows converge on the same rows.
 */
async function search(query: string, from: string, to: string): Promise<Omit<Story, "symbol">[]> {
  const q = `${query} after:${from} before:${to}`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
  const r = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
    headers: { "user-agent": "Mozilla/5.0 (compatible; PreCall/1.0; +https://precallipo.com)" },
  });
  if (!r.ok) throw new Error(`news HTTP ${r.status}`);
  const xml = await r.text();
  if (!xml.includes("<rss")) throw new Error(`news: not RSS (${xml.slice(0, 60)})`);
  const out: Omit<Story, "symbol">[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const it = m[1];
    const full = decode(it.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
    const publisher = decode(it.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? "") || null;
    const link = decode(it.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "");
    const at = Date.parse(it.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "");
    if (!full || !link || !Number.isFinite(at)) continue;
    const title = publisher && full.endsWith(` - ${publisher}`) ? full.slice(0, -(publisher.length + 3)) : full;
    out.push({ day: dayOf(at), publishedAt: at, title, publisher, url: link });
  }
  return out;
}

/** Diagnostic: one live query from this runtime (Google may treat datacenter IPs differently). */
export async function probeNews(): Promise<{ ok: boolean; items?: number; ms: number; error?: string }> {
  const t = Date.now();
  try {
    const today = dayOf(Date.now());
    const items = await search('"OpenAI"', addDays(today, -1), addDays(today, 1));
    return { ok: true, items: items.length, ms: Date.now() - t };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 200), ms: Date.now() - t };
  }
}

/** Same story syndicated under the same headline counts once per company. */
const storyId = (symbol: string, title: string) =>
  createHash("sha1")
    .update(`${symbol}|${title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`)
    .digest("hex")
    .slice(0, 20);

async function ingest(symbol: string, name: string, from: string, to: string): Promise<number> {
  const p = profileFor(symbol, name);
  const found = await search(p.query, from, to);
  const keep = found.filter((s) => headlineMatches(s.title, p) && !isSpam(s.title, s.publisher));
  if (!keep.length) return 0;
  const ids = keep.map((s) => storyId(symbol, s.title));
  await sql`
    insert into news (id, symbol, day, published_at, title, publisher, url)
    select x.id, ${symbol}, x.day::date, to_timestamp(x.at / 1000.0), x.title, x.publisher, x.url
    from unnest(${ids}::text[], ${keep.map((s) => s.day)}::text[], ${keep.map((s) => s.publishedAt)}::float8[],
                ${keep.map((s) => s.title)}::text[], ${keep.map((s) => s.publisher)}::text[],
                ${keep.map((s) => s.url)}::text[]) as x(id, day, at, title, publisher, url)
    on conflict (id) do nothing`;
  return keep.length;
}

/**
 * Keep the news table filled: today's window every 20 minutes, and every past day
 * read once after it has fully closed (a day is re-read if its only read was taken
 * while it was still open). Works inside a time budget, so a page view or cron run
 * never blocks on the backfill; the next run picks up where this one stopped.
 */
export async function refreshNews(budgetMs = 60_000, now = Date.now()): Promise<{ fetched: number; stories: number; left: number }> {
  // The lock outlives the longest possible run, then is released early (below), so
  // two refreshes never overlap and the next may start a minute after this one ends.
  if (!(await claim("news", LOCK_SEC))) return { fetched: 0, stories: 0, left: -1 };
  const t0 = Date.now();
  const tokens = await listTokens();
  const today = dayOf(now);
  const log = await sql`select key, fetched_at, ok from fetch_log where key like 'news:%'`;
  const seen = new Map(log.map((r) => [r.key as string, { at: new Date(r.fetched_at).getTime(), ok: r.ok as boolean }]));

  type Job = { key: string; symbol: string; name: string; from: string; to: string };
  const jobs: Job[] = [];
  for (const t of tokens) {
    const live = seen.get(`news:${t.symbol}:live`);
    if (!live || !live.ok || now - live.at > LIVE_REFRESH_SEC * 1000)
      jobs.push({ key: `news:${t.symbol}:live`, symbol: t.symbol, name: t.name, from: addDays(today, -1), to: addDays(today, 1) });
  }
  // Past days, newest first: the recent chart fills before the deep history.
  for (let i = 1; i <= NEWS_DAYS; i++) {
    const day = addDays(today, -i);
    for (const t of tokens) {
      const key = `news:${t.symbol}:${day}`;
      const s = seen.get(key);
      // Complete once read after the window [day, day+1] had fully passed.
      if (s?.ok && s.at >= dayStart(day) + 2 * DAY_MS) continue;
      if (s?.ok && now < dayStart(day) + 2 * DAY_MS && now - s.at < LIVE_REFRESH_SEC * 1000) continue;
      jobs.push({ key, symbol: t.symbol, name: t.name, from: day, to: addDays(day, 1) });
    }
  }

  let fetched = 0;
  let stories = 0;
  for (const j of jobs) {
    if (Date.now() - t0 > budgetMs) break;
    try {
      stories += await ingest(j.symbol, j.name, j.from, j.to);
      await sql`insert into fetch_log (key, fetched_at, ok) values (${j.key}, now(), true)
                on conflict (key) do update set fetched_at = now(), ok = true, note = null`;
    } catch (e) {
      await sql`insert into fetch_log (key, fetched_at, ok, note) values (${j.key}, now(), false, ${String(e).slice(0, 300)})
                on conflict (key) do update set fetched_at = now(), ok = false, note = excluded.note`;
    }
    fetched++;
    await new Promise((ok) => setTimeout(ok, SPACING_MS));
  }
  await markFetch("news", true, `fetched ${fetched}/${jobs.length}, ${stories} stories`);
  await releaseClaim("news", 60, LOCK_SEC);
  return { fetched, stories, left: jobs.length - fetched };
}

export interface StoredStory {
  id: string;
  symbol: string;
  day: string;
  publishedAt: number;
  title: string;
  publisher: string | null;
  url: string;
}

export async function readNews(sinceDay: string, symbol?: string): Promise<StoredStory[]> {
  const rows = symbol
    ? await sql`select id, symbol, day::text as day, published_at, title, publisher, url from news
                where day >= ${sinceDay}::date and symbol = ${symbol} order by published_at desc`
    : await sql`select id, symbol, day::text as day, published_at, title, publisher, url from news
                where day >= ${sinceDay}::date order by published_at desc`;
  return rows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    day: r.day,
    publishedAt: new Date(r.published_at).getTime(),
    title: r.title,
    publisher: r.publisher,
    url: r.url,
  }));
}
