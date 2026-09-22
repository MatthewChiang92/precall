import "server-only";
import { claim, markFetch, sql, touch } from "./db";
import { refreshNews } from "./news";
import { refreshRegistry } from "./prestocks";
import {
  type Bar,
  FALLBACK,
  PRIMARY,
  type Source,
  fetchAndStore,
  priceAt,
  refreshBars,
  sourceAvailable,
} from "./prices";
import { refreshVibe } from "./vibe";
import { DAY_MS, HISTORY_DAYS, LAUNCH_DAY, addDays, clock, dayStart, settleable } from "./time";

/** A move smaller than this (0.01%) is a push: nobody wins or loses it. */
export const FLAT_EPS = 1e-4;

/** A gecko pool whose last trade is older than this, relative to the close, is not trusted. */
const POOL_STALE_MS = 3 * DAY_MS;

export type Result = "UP" | "DOWN" | "FLAT" | "VOID";

export function classify(ret: number): Result {
  if (Math.abs(ret) < FLAT_EPS) return "FLAT";
  return ret > 0 ? "UP" : "DOWN";
}

/** Days that should have results by now: recent history plus every round since launch. */
function daysToSettle(now: number): string[] {
  const { lastClosedDay } = clock(now);
  const launchHistory = addDays(LAUNCH_DAY, -HISTORY_DAYS);
  const recent = addDays(lastClosedDay, -HISTORY_DAYS + 1);
  const from = launchHistory < recent ? launchHistory : recent;
  const out: string[] = [];
  for (let d = from; d <= lastClosedDay; d = addDays(d, 1)) if (settleable(d, now)) out.push(d);
  return out;
}

/**
 * Settle every closed day that is missing a result for any listed token.
 * Results are INSERT-only: once a (day, token) is settled it never changes.
 * Both the open and the close come from ONE fresh fetch of ONE source, so a
 * round never compares prices from two different feeds.
 */
export async function settlePending(now = Date.now()): Promise<{ settled: number; pending: number }> {
  const days = daysToSettle(now);
  if (!days.length) return { settled: 0, pending: 0 };
  if (!(await claim("settle", 600))) return { settled: 0, pending: -1 };

  const tokens = await sql`select symbol, mint from tokens order by symbol`;
  const done = await sql`
    select day::text as day, symbol from round_results where day >= ${days[0]}::date`;
  const have = new Set(done.map((r) => `${r.day}|${r.symbol}`));

  let settled = 0;
  let pending = 0;
  const notes: string[] = [];

  for (const tk of tokens) {
    const missing = days.filter((d) => !have.has(`${d}|${tk.symbol}`));
    if (!missing.length) continue;

    const series = new Map<Source, Bar[] | null>();
    const getSeries = async (s: Source) => {
      if (!series.has(s)) {
        try {
          series.set(s, await fetchAndStore(tk.mint, "1h", s));
          if (s === PRIMARY) await touch(`bars:1h:${tk.mint}`);
        } catch (e) {
          notes.push(`${tk.symbol}/${s}: ${String(e).slice(0, 120)}`);
          series.set(s, null);
        }
      }
      return series.get(s)!;
    };

    for (const day of missing) {
      const t0 = dayStart(day);
      const t1 = t0 + DAY_MS;
      let row: { open: number; close: number; source: Source } | null = null;
      for (const s of [PRIMARY, FALLBACK]) {
        if (!sourceAvailable(s)) continue;
        const bars = await getSeries(s);
        if (!bars) continue;
        // A pool-level series (gecko) that stopped trading says nothing about the
        // token, which may trade in other pools. Token-level (gmgn) silence is a real flat.
        if (s === "gecko" && (bars.at(-1)?.t ?? 0) < t1 - POOL_STALE_MS) continue;
        const open = priceAt(bars, t0);
        const close = priceAt(bars, t1);
        if (open !== null && close !== null) {
          row = { open, close, source: s };
          break;
        }
      }
      if (row) {
        const ret = row.close / row.open - 1;
        await sql`
          insert into round_results (day, symbol, mint, open_price, close_price, ret, result, source)
          values (${day}::date, ${tk.symbol}, ${tk.mint}, ${row.open}, ${row.close}, ${ret},
                  ${classify(ret)}, ${row.source})
          on conflict (day, symbol) do nothing`;
        settled++;
      } else {
        // Never auto-VOID: a gap in OUR data is not a fact about the market.
        // The day stays pending (calls on it score nothing) until prices prove it.
        pending++;
      }
    }
  }
  await markFetch("settle", pending === 0, `settled ${settled}, pending ${pending}; ${notes.join("; ")}`.slice(0, 900));
  return { settled, pending };
}

/** Everything the site needs kept warm. Safe to call from any request; all steps are throttled. */
export async function refreshAll(now = Date.now(), newsBudgetMs = 45_000) {
  await refreshRegistry();
  // Settle first: it fetches fresh hourly series and marks them, so the display
  // refresh below does not fetch the same data twice.
  const out = await settlePending(now);
  const tokens = await sql`select mint from tokens where last_seen > now() - interval '1 day'`;
  for (const t of tokens) {
    await refreshBars(t.mint, "1h");
    await refreshBars(t.mint, "1d");
  }
  // News after prices: the index reads both. Each step is throttled and never throws.
  const news = await refreshNews(newsBudgetMs, now).catch((e) => ({ error: String(e) }));
  await refreshVibe(now).catch((e) => console.error("vibe", e));
  return { ...out, news };
}
