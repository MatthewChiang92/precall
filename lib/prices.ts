import "server-only";
import { claim, markFetch, releaseClaim, sql } from "./db";

export type Res = "1h" | "1d";
export type Source = "gmgn" | "gecko";

/** One OHLCV bar. `t` is the bar START in epoch ms. Bars exist only for periods that traded. */
export interface Bar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number | null;
}

const GMGN_KEY = process.env.GMGN_API_KEY || "";
export const PRIMARY: Source = GMGN_KEY ? "gmgn" : "gecko";
export const FALLBACK: Source = PRIMARY === "gmgn" ? "gecko" : "gmgn";

export function sourceAvailable(s: Source) {
  return s === "gecko" || Boolean(GMGN_KEY);
}

const RES_MS: Record<Res, number> = { "1h": 3_600_000, "1d": 86_400_000 };
export const resMs = (r: Res) => RES_MS[r];

const finite = (v: unknown) => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : NaN;
};

function clean(bars: Bar[]): Bar[] {
  const ok = bars.filter((b) => [b.t, b.o, b.h, b.l, b.c].every(Number.isFinite) && b.c > 0);
  ok.sort((a, b) => a.t - b.t);
  // de-duplicate on t (keep last)
  const out: Bar[] = [];
  for (const b of ok) {
    if (out.length && out[out.length - 1].t === b.t) out[out.length - 1] = b;
    else out.push(b);
  }
  return out;
}

/* ------------------------------------------------------------------ GMGN */
// Token-level: aggregates every pool. Serves the LAST ~100 bars only. `client_id`
// is single-use and auth failures arrive as HTTP 200 with a non-zero `code`.

// Calls are serialised and spaced, and a 429 (GMGN bans the IP after repeated
// violations) pauses GMGN for this instance so we fall back instead of digging deeper.
let gmgnChain: Promise<unknown> = Promise.resolve();
let gmgnPausedUntil = 0;
const GMGN_SPACING_MS = 1_100;
const GMGN_PAUSE_MS = 10 * 60_000;

function gmgnBars(mint: string, res: Res): Promise<Bar[]> {
  const run = () => gmgnFetch(mint, res);
  const p = gmgnChain.then(run, run);
  const gap = () => new Promise((ok) => setTimeout(ok, GMGN_SPACING_MS));
  gmgnChain = p.then(gap, gap);
  return p;
}

async function gmgnFetch(mint: string, res: Res): Promise<Bar[]> {
  if (!GMGN_KEY) throw new Error("GMGN_API_KEY not set");
  if (Date.now() < gmgnPausedUntil) throw new Error("gmgn paused after 429");
  const qs = new URLSearchParams({
    chain: "sol",
    address: mint,
    resolution: res,
    timestamp: String(Math.floor(Date.now() / 1000)),
    client_id: crypto.randomUUID(),
  });
  const r = await fetch(`https://openapi.gmgn.ai/v1/market/token_kline?${qs}`, {
    headers: { "X-APIKEY": GMGN_KEY, accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const text = await r.text();
  let j: { code?: unknown; data?: { list?: unknown[] }; message?: unknown };
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error(`gmgn HTTP ${r.status} non-JSON: ${text.slice(0, 80)}`);
  }
  if (r.status === 429 || j.code === 429) gmgnPausedUntil = Date.now() + GMGN_PAUSE_MS;
  if (j.code !== 0) throw new Error(`gmgn code ${String(j.code)} ${String(j.message ?? "")} (HTTP ${r.status})`);
  const list = Array.isArray(j.data?.list) ? j.data!.list! : [];
  return clean(
    list.map((x) => {
      const row = x as Record<string, unknown>;
      let t = finite(row.time);
      if (t < 1e12) t *= 1000; // tolerate seconds
      return {
        t,
        o: finite(row.open),
        h: finite(row.high),
        l: finite(row.low),
        c: finite(row.close),
        v: Number.isFinite(finite(row.volume)) ? finite(row.volume) : null,
      };
    }),
  );
}

/* ------------------------------------------------------------- GeckoTerminal */
// Pool-level, so we pick the deepest pool and ask for prices of OUR token in it.
// Free and keyless but rate-limited hard: calls are serialised and spaced.

let geckoChain: Promise<unknown> = Promise.resolve();
const GECKO_SPACING_MS = 2_200;

function geckoGet(path: string): Promise<unknown> {
  const run = async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch(`https://api.geckoterminal.com/api/v2${path}`, {
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      if (r.status === 429) {
        await new Promise((ok) => setTimeout(ok, 5_000 * (attempt + 1)));
        continue;
      }
      if (!r.ok) throw new Error(`gecko HTTP ${r.status} ${path}`);
      return r.json();
    }
    throw new Error(`gecko 429 x3 ${path}`);
  };
  const p = geckoChain.then(run, run);
  geckoChain = p.then(
    () => new Promise((ok) => setTimeout(ok, GECKO_SPACING_MS)),
    () => new Promise((ok) => setTimeout(ok, GECKO_SPACING_MS)),
  );
  return p;
}

/**
 * The pool whose price stands in for the token. Chosen by 24h VOLUME, not by
 * reserves: several PreStocks tokens have a deep but abandoned pool whose last
 * trade was months ago, and a reserve ranking picks exactly that one.
 * Re-chosen at most daily.
 */
async function geckoPool(mint: string): Promise<string> {
  const rows = await sql`select gecko_pool from tokens where mint = ${mint}`;
  const stored = (rows[0]?.gecko_pool as string | null) ?? null;
  if (stored && !(await claim(`geckopool:${mint}`, 86_400))) return stored;
  try {
    const j = (await geckoGet(`/networks/solana/tokens/${mint}/pools?page=1`)) as {
      data?: { attributes?: { address?: string; volume_usd?: { h24?: string }; reserve_in_usd?: string } }[];
    };
    const pools = (j.data ?? [])
      .map((p) => ({
        a: p.attributes?.address,
        vol: Number(p.attributes?.volume_usd?.h24 ?? 0),
        res: Number(p.attributes?.reserve_in_usd ?? 0),
      }))
      .filter((p): p is { a: string; vol: number; res: number } => Boolean(p.a));
    if (!pools.length) throw new Error(`gecko: no pools for ${mint}`);
    pools.sort((a, b) => b.vol - a.vol || b.res - a.res);
    await sql`update tokens set gecko_pool = ${pools[0].a} where mint = ${mint}`;
    return pools[0].a;
  } catch (e) {
    if (stored) return stored;
    throw e;
  }
}

async function geckoBars(mint: string, res: Res): Promise<Bar[]> {
  const pool = await geckoPool(mint);
  const tf = res === "1h" ? "hour" : "day";
  const j = (await geckoGet(
    `/networks/solana/pools/${pool}/ohlcv/${tf}?limit=1000&currency=usd&token=${mint}`,
  )) as { data?: { attributes?: { ohlcv_list?: unknown[][] } } };
  const list = j.data?.attributes?.ohlcv_list ?? [];
  return clean(
    list.map((x) => ({
      t: finite(x[0]) * 1000,
      o: finite(x[1]),
      h: finite(x[2]),
      l: finite(x[3]),
      c: finite(x[4]),
      v: Number.isFinite(finite(x[5])) ? finite(x[5]) : null,
    })),
  );
}

/* ------------------------------------------------------------------ store */

export async function fetchBars(mint: string, res: Res, source: Source): Promise<Bar[]> {
  return source === "gmgn" ? gmgnBars(mint, res) : geckoBars(mint, res);
}

async function storeBars(mint: string, res: Res, source: Source, bars: Bar[]) {
  if (!bars.length) return;
  await sql`
    insert into candles (mint, res, source, t, o, h, l, c, v)
    select ${mint}, ${res}, ${source}, to_timestamp(x.t / 1000.0), x.o, x.h, x.l, x.c, x.v
    from unnest(${bars.map((b) => b.t)}::float8[], ${bars.map((b) => b.o)}::float8[],
                ${bars.map((b) => b.h)}::float8[], ${bars.map((b) => b.l)}::float8[],
                ${bars.map((b) => b.c)}::float8[], ${bars.map((b) => b.v)}::float8[])
         as x(t, o, h, l, c, v)
    on conflict (mint, res, source, t) do update set
      o = excluded.o, h = excluded.h, l = excluded.l, c = excluded.c, v = excluded.v`;
}

/** Fetch from `source` and persist. Returns the fresh bars (ascending). */
export async function fetchAndStore(mint: string, res: Res, source: Source): Promise<Bar[]> {
  const bars = await fetchBars(mint, res, source);
  await storeBars(mint, res, source, bars);
  return bars;
}

const MAX_AGE_SEC: Record<Res, number> = { "1h": 300, "1d": 3_600 };

/**
 * Throttled refresh for display data. Primary source first, fallback on failure.
 * Never throws: a failed upstream leaves the last stored bars in place.
 */
export async function refreshBars(mint: string, res: Res): Promise<void> {
  const key = `bars:${res}:${mint}`;
  const maxAge = MAX_AGE_SEC[res];
  if (!(await claim(key, maxAge))) return;
  const errors: string[] = [];
  for (const source of [PRIMARY, FALLBACK]) {
    if (!sourceAvailable(source)) continue;
    try {
      const bars = await fetchAndStore(mint, res, source);
      await markFetch(key, true, `${source}:${bars.length}`);
      return;
    } catch (e) {
      errors.push(`${source}: ${String(e)}`);
    }
  }
  await markFetch(key, false, errors.join(" | ").slice(0, 500));
  await releaseClaim(key, 60, maxAge);
}

/** Stored bars for display, preferring the primary source. Ascending. */
export async function readBars(mint: string, res: Res, sinceMs: number): Promise<{ source: Source | null; bars: Bar[] }> {
  const rows = await sql`
    select source, extract(epoch from t) * 1000 as t, o, h, l, c, v
    from candles
    where mint = ${mint} and res = ${res} and t >= to_timestamp(${sinceMs} / 1000.0)
    order by t`;
  for (const source of [PRIMARY, FALLBACK]) {
    const bars = rows
      .filter((r) => r.source === source)
      .map((r) => ({ t: Number(r.t), o: r.o, h: r.h, l: r.l, c: r.c, v: r.v }));
    if (bars.length) return { source, bars };
  }
  return { source: null, bars: [] };
}

/**
 * Price at instant `at` from a CONTIGUOUS series of hourly bars: the close of the
 * last bar that finished at or before `at`. A missing bar means no trade, so the
 * last trade carries forward. Returns null when the series does not reach back
 * far enough to prove what the price was at `at`.
 */
export function priceAt(bars: Bar[], at: number, res: Res = "1h"): number | null {
  if (!bars.length) return null;
  const step = resMs(res);
  if (bars[0].t + step > at) return null; // series starts after `at`: cannot know
  let p: number | null = null;
  for (const b of bars) {
    if (b.t + step <= at) p = b.c;
    else break;
  }
  return p;
}
