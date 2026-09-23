// SpaceX's frozen pre-listing history (scripts/snapshot-spacex-ipo.mjs), for Seed to IPO's
// SpaceX course. Client-safe.
import raw from "./data/spacex-ipo.json";
import { DAY_MS, dayStart, weeklyCloses } from "./time";

/**
 * PreStocks applied SpaceX's 5-for-1 split on-chain with the Token-2022 scaledUiAmount
 * extension (multiplier 1 -> 5). DEX feeds quote the raw (unscaled) token, so one raw
 * token = 5 post-split shares; dividing by 5 gives a per-share price.
 */
const SPLIT = 5;

/** End of listing day (UTC): the SpaceX course's last close. */
const listingClose = dayStart(raw.listingDay) + DAY_MS;
const daily = raw.token.daily.filter((b) => b.t < listingClose).map((b) => ({ t: b.t, c: b.c / SPLIT }));

export const IPO = {
  mint: raw.mints.token,
  listingDay: raw.listingDay,
  /**
   * Weekly token closes per post-split share, stamped at each week's close like the live
   * series: every full week before the listing, then the listing week, closing on listing day.
   */
  preListing: [...weeklyCloses(daily, listingClose - 1), { t: listingClose, c: daily[daily.length - 1].c }],
};
