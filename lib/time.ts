// Rounds are UTC days. Round D opens for calls during day D-1, LOCKS at D 00:00 UTC
// (the opening reference price), and SETTLES at D+1 00:00 UTC (the closing price).

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;

/** First round that counts for the leaderboard. Round numbers are relative to it. */
export const LAUNCH_DAY = "2026-09-22";

/** Settlement waits this long past the close so the last hourly bar is final upstream. */
export const SETTLE_DELAY_MS = 10 * 60_000;

/** Days of market history (pre-launch included) the results strip shows. */
export const HISTORY_DAYS = 7;

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

export function roundNumber(day: string): number {
  return Math.round((dayStart(day) - dayStart(LAUNCH_DAY)) / DAY_MS) + 1;
}

export interface Clock {
  now: number;
  /** Accepting calls; locks at dayStart(openDay). */
  openDay: string;
  /** Locked, in progress; settles at dayStart(openDay). */
  liveDay: string;
  /** Most recent day whose close has passed. May still be awaiting settlement. */
  lastClosedDay: string;
  lockAt: number;
}

export function clock(now = Date.now()): Clock {
  const today = dayOf(now);
  const openDay = addDays(today, 1);
  return {
    now,
    openDay,
    liveDay: today,
    lastClosedDay: addDays(today, -1),
    lockAt: dayStart(openDay),
  };
}

export function settleable(day: string, now = Date.now()): boolean {
  return now >= dayStart(day) + DAY_MS + SETTLE_DELAY_MS;
}
