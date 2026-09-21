import "server-only";
import { sql } from "./db";
import { type Crowd, crowdFor, playerCount } from "./game";
import { listTokens } from "./prestocks";
import { PRIMARY, priceAt, readBars } from "./prices";
import { DAY_MS, HISTORY_DAYS, HOUR_MS, addDays, clock, dayStart, roundNumber } from "./time";

/** Context a player needs that no API states. Keyed by ticker; tokens without a note get none. */
export const TOKEN_NOTES: Record<string, string> = {
  SPACEX:
    "SpaceX listed on Nasdaq (SPCX) on 12 Jun 2026 after a 5-for-1 split. The on-chain token still quotes the pre-split basis; calls are scored on % moves, so the basis cancels out.",
};

export interface BoardToken {
  symbol: string;
  name: string;
  mint: string;
  image: string | null;
  url: string | null;
  description: string | null;
  markPrice: number | null;
  tokenPrice: number | null;
  /** token price vs PreStocks mark, both from the PreStocks API (same basis). */
  premium: number | null;
  note: string | null;
  firstSeen: string;
  /** Live round: on-chain price at lock, latest on-chain price, move so far. Provisional. */
  live: { open: number | null; last: number | null; lastAt: number | null; ret: number | null };
  /** Daily on-chain closes, oldest first, for the sparkline. */
  spark: { t: number; c: number }[];
  change24h: number | null;
  source: string | null;
}

export interface DayResult {
  day: string;
  round: number;
  results: Record<string, { ret: number | null; result: string; open: number | null; close: number | null; source: string | null }>;
}

export interface Board {
  now: number;
  openDay: string;
  liveDay: string;
  openRound: number;
  liveRound: number;
  lockAt: number;
  tokens: BoardToken[];
  history: DayResult[];
  liveCrowd: Record<string, Crowd>;
  openCallCount: number;
  players: number;
  primarySource: string;
}

export async function getBoard(now = Date.now()): Promise<Board> {
  const c = clock(now);
  const liveStart = dayStart(c.liveDay);
  const firstHistory = addDays(c.liveDay, -HISTORY_DAYS);

  const [tokens, resultRows, crowds, openCount, players] = await Promise.all([
    listTokens(),
    sql`select day::text as day, symbol, ret, result, open_price, close_price, source
        from round_results where day >= ${firstHistory}::date order by day desc`,
    crowdFor([c.liveDay]),
    sql`select count(*)::int as n from calls where day = ${c.openDay}::date`,
    playerCount(),
  ]);

  const boardTokens: BoardToken[] = await Promise.all(
    tokens.map(async (t) => {
      const [hourly, daily] = await Promise.all([
        readBars(t.mint, "1h", liveStart - 3 * DAY_MS),
        readBars(t.mint, "1d", now - 45 * DAY_MS),
      ]);
      const open = priceAt(hourly.bars, liveStart);
      const lastBar = hourly.bars.at(-1) ?? null;
      const last = lastBar?.c ?? null;
      const dayAgo = priceAt(hourly.bars, now - 24 * HOUR_MS);
      return {
        symbol: t.symbol,
        name: t.name,
        mint: t.mint,
        image: t.image,
        url: t.url,
        description: t.description,
        markPrice: t.markPrice,
        tokenPrice: t.tokenPrice,
        premium: t.markPrice && t.tokenPrice ? t.tokenPrice / t.markPrice - 1 : null,
        note: TOKEN_NOTES[t.symbol] ?? null,
        firstSeen: t.firstSeen,
        live: {
          open,
          last,
          lastAt: lastBar ? lastBar.t + HOUR_MS : null,
          ret: open && last ? last / open - 1 : null,
        },
        spark: daily.bars.slice(-30).map((b) => ({ t: b.t, c: b.c })),
        change24h: dayAgo && last ? last / dayAgo - 1 : null,
        source: hourly.source ?? daily.source,
      };
    }),
  );

  const byDay = new Map<string, DayResult>();
  for (const r of resultRows) {
    const d: DayResult = byDay.get(r.day) ?? { day: r.day, round: roundNumber(r.day), results: {} };
    d.results[r.symbol] = {
      ret: r.ret,
      result: r.result,
      open: r.open_price,
      close: r.close_price,
      source: r.source,
    };
    byDay.set(r.day, d);
  }

  return {
    now,
    openDay: c.openDay,
    liveDay: c.liveDay,
    openRound: roundNumber(c.openDay),
    liveRound: roundNumber(c.liveDay),
    lockAt: c.lockAt,
    tokens: boardTokens,
    history: [...byDay.values()],
    liveCrowd: crowds[c.liveDay] ?? {},
    openCallCount: openCount[0]?.n ?? 0,
    players,
    primarySource: PRIMARY,
  };
}

/** Daily on-chain closes for every listed token, for Rewind. */
export async function getRewindSeries() {
  const tokens = await listTokens();
  return Promise.all(
    tokens.map(async (t) => {
      const { bars, source } = await readBars(t.mint, "1d", 0);
      return {
        symbol: t.symbol,
        name: t.name,
        image: t.image,
        mint: t.mint,
        source,
        bars: bars.map((b) => ({ t: b.t, c: b.c })),
      };
    }),
  );
}
