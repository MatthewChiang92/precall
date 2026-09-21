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

export function countdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((x) => String(x).padStart(2, "0")).join(":");
}

export function jupiterUrl(mint: string) {
  return `https://jup.ag/swap/USDC-${mint}`;
}

export function signClass(r: number | null | undefined) {
  if (r === null || r === undefined || !Number.isFinite(r) || Math.abs(r) < 1e-4) return "flat";
  return r > 0 ? "up" : "down";
}
