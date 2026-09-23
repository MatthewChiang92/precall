// Rounds are UTC weeks, Monday to Monday, and a round is named by its Monday
// (the `day` fields and columns hold that date). Round W opens for calls during the
// week before, LOCKS at W 00:00 UTC (the opening reference price), and SETTLES at
// W+7 00:00 UTC (the closing price).

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;
export const WEEK_MS = 7 * DAY_MS;

/** First round that counts for the leaderboard (a Monday). Round numbers are relative to it. */
export const LAUNCH_DAY = "2026-09-28";

/** Settlement waits this long past the close so the last hourly bar is final upstream. */
export const SETTLE_DELAY_MS = 10 * 60_000;

/** Weeks of market history (pre-launch included) the results strip shows. */
export const HISTORY_WEEKS = 6;

export function dayOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function dayStart(day: string): number {
  const ms = Date.parse(`${day}T00:00:00.000Z`);
  if (Number.isNaN(ms)) throw new Error(`bad day ${day}`);
  return ms;
}

export function addDays(day: string, n: number): string {
  return dayOf(dayStart(day) + n * DAY_MS);
}

export function isDay(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && dayOf(dayStart(s)) === s;
}

/** The Monday (UTC) of the week containing `ms`. */
export function weekOf(ms: number): string {
  const d = new Date(ms);
  return addDays(dayOf(ms), -((d.getUTCDay() + 6) % 7));
}

/**
 * Weekly closes from daily bars (each `t` a UTC day start). One point per UTC week,
 * stamped at the week's close (the next Monday 00:00) and holding the last daily close
 * before it, so a week with no trades carries the last price. Only weeks closing at or
 * before `until` are included.
 */
export function weeklyCloses(daily: { t: number; c: number }[], until: number): { t: number; c: number }[] {
  const out: { t: number; c: number }[] = [];
  if (!daily.length) return out;
  let k = 0;
  let last = daily[0].c;
  for (let end = dayStart(weekOf(daily[0].t)) + WEEK_MS; end <= until; end += WEEK_MS) {
    while (k < daily.length && daily[k].t + DAY_MS <= end) last = daily[k++].c;
    out.push({ t: end, c: last });
  }
  return out;
}

export function roundNumber(week: string): number {
  return Math.round((dayStart(week) - dayStart(LAUNCH_DAY)) / WEEK_MS) + 1;
}

export interface Clock {
  now: number;
  /** Accepting calls; locks at dayStart(openDay). A Monday. */
  openDay: string;
  /** Locked, in progress; settles at dayStart(openDay). A Monday. */
  liveDay: string;
  /** Most recent round whose close has passed. May still be awaiting settlement. */
  lastClosedDay: string;
  lockAt: number;
}

export function clock(now = Date.now()): Clock {
  const week = weekOf(now);
  const openDay = addDays(week, 7);
  return {
    now,
    openDay,
    liveDay: week,
    lastClosedDay: addDays(week, -7),
    lockAt: dayStart(openDay),
  };
}

export function settleable(week: string, now = Date.now()): boolean {
  return now >= dayStart(week) + WEEK_MS + SETTLE_DELAY_MS;
}
