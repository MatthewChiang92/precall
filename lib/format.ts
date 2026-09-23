// Client-safe formatting helpers.

export function fmtPrice(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const d = n >= 1000 ? 0 : n >= 100 ? 1 : n >= 1 ? 2 : 4;
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtPct(r: number | null | undefined, digits = 2): string {
  if (r === null || r === undefined || !Number.isFinite(r)) return "—";
  const v = r * 100;
  return (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(v).toFixed(digits) + "%";
}

export function dayLabel(day: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });
}

/** A round's week, from its Monday: "21–27 Sep", or "28 Sep – 4 Oct" across months. */
export function weekLabel(monday: string): string {
  const a = new Date(`${monday}T00:00:00Z`);
  const b = new Date(a.getTime() + 6 * 86_400_000);
  const f = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-GB", { ...o, timeZone: "UTC" });
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${a.getUTCDate()}–${f(b, { day: "numeric", month: "short" })}`
    : `${f(a, { day: "numeric", month: "short" })} – ${f(b, { day: "numeric", month: "short" })}`;
}

export function countdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const hms = [h, m, sec].map((x) => String(x).padStart(2, "0")).join(":");
  return d ? `${d}d ${hms}` : hms;
}

export function jupiterUrl(mint: string) {
  return `https://jup.ag/swap/USDC-${mint}`;
}

export function signClass(r: number | null | undefined) {
  if (r === null || r === undefined || !Number.isFinite(r) || Math.abs(r) < 1e-4) return "flat";
  return r > 0 ? "up" : "down";
}
