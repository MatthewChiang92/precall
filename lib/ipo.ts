// SpaceX IPO Replay: frozen on-chain history (scripts/snapshot-spacex-ipo.mjs) plus
// the handful of off-chain facts the story needs, each with its source. Client-safe.
import raw from "./data/spacex-ipo.json";

export type PBar = { t: number; c: number; v: number };

/**
 * PreStocks applied SpaceX's 5-for-1 split on-chain with the Token-2022
 * scaledUiAmount extension (multiplier 1 -> 5, effective 2026-06-10 04:30 UTC):
 * every wallet shows 5x the tokens. DEX feeds quote the raw (unscaled) token,
 * so one raw token = 5 post-split shares. Dividing by 5 puts the token on the
 * same per-share basis as the public stock across the whole history.
 */
export const SPLIT = 5;
export const SPLIT_EFFECTIVE = Date.UTC(2026, 5, 10, 4, 30);

const perShare = (b: { t: number; c: number; v: number }): PBar => ({ t: b.t, c: b.c / SPLIT, v: b.v });
const plain = (b: { t: number; c: number; v: number }): PBar => ({ t: b.t, c: b.c, v: b.v });

export const IPO = {
  mint: raw.mints.token,
  spcxxMint: raw.mints.spcxx,
  tokenPool: raw.pools.token,
  spcxxPool: raw.pools.spcxx,
  generatedAt: raw.generatedAt,
  listingDay: raw.listingDay,
  listingStart: Date.UTC(2026, 5, 12),
  /** US regular session opens 09:30 ET = 13:30 UTC in June (EDT). */
  usOpen: Date.UTC(2026, 5, 12, 13, 30),
  token: { daily: raw.token.daily.map(perShare), hourly: raw.token.hourly.map(perShare) },
  spcxx: { daily: raw.spcxx.daily.map(plain), hourly: raw.spcxx.hourly.map(plain) },
  /** Daily token closes per post-split share up to and including listing day, for Seed to IPO's SpaceX course. */
  preListing: raw.token.daily.filter((b) => b.t <= Date.UTC(2026, 5, 12)).map((b) => ({ t: b.t, c: b.c / SPLIT })),
};

export const FACTS = {
  ipoPrice: 135,
  firstDayClose: 161.11,
  swapDeadline: "11:59pm UTC on 12 March 2027",
  lockupMonths: 6,
};

export const SOURCES = {
  ipoPrice: { label: "SpaceX on X", url: "https://x.com/SpaceX/status/2065154746810327356" },
  listing: { label: "Wikipedia: IPO of SpaceX", url: "https://en.wikipedia.org/wiki/Initial_public_offering_of_SpaceX" },
  firstDay: {
    label: "Fortune, 12 Jun 2026",
    url: "https://fortune.com/2026/06/12/spacex-ipo-trading-first-day-live-updates-elon-musk/",
  },
  splitVote: {
    label: "Bloomberg, 16 May 2026",
    url: "https://www.bloomberg.com/news/articles/2026-05-16/spacex-shareholders-approve-5-for-1-stock-split-of-common-stock",
  },
  splitOnChain: { label: "Mint on Solscan", url: `https://solscan.io/token/${raw.mints.token}#extensions` },
  lockup: { label: "PreStocks on X, 7 Jun 2026", url: "https://x.com/PreStocks/status/2063623768535363940" },
  deadline: { label: "prestocks.com/spacex", url: "https://prestocks.com/spacex" },
  tokenPool: { label: "GeckoTerminal pool", url: `https://www.geckoterminal.com/solana/pools/${raw.pools.token}` },
  spcxxPool: { label: "GeckoTerminal pool", url: `https://www.geckoterminal.com/solana/pools/${raw.pools.spcxx}` },
};

/** Last bar at or before t. */
export function at(bars: PBar[], t: number): PBar | null {
  let out: PBar | null = null;
  for (const b of bars) if (b.t <= t) out = b;
  return out;
}
