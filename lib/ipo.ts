// SpaceX's frozen pre-listing history (scripts/snapshot-spacex-ipo.mjs), for Seed to IPO's
// SpaceX course. Client-safe.
import raw from "./data/spacex-ipo.json";

/**
 * PreStocks applied SpaceX's 5-for-1 split on-chain with the Token-2022 scaledUiAmount
 * extension (multiplier 1 -> 5). DEX feeds quote the raw (unscaled) token, so one raw
 * token = 5 post-split shares; dividing by 5 gives a per-share price.
 */
const SPLIT = 5;

export const IPO = {
  mint: raw.mints.token,
  listingDay: raw.listingDay,
  /** Daily token closes per post-split share up to and including listing day. */
  preListing: raw.token.daily.filter((b) => b.t <= Date.UTC(2026, 5, 12)).map((b) => ({ t: b.t, c: b.c / SPLIT })),
};
