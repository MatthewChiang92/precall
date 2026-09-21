// Shared by the Rewind server page (first deal) and the client (every next deal).

export type Puzzle = { s: number; i: number };
export const WINDOW = 20;

export function pick(series: { bars: { c: number }[] }[]): Puzzle | null {
  if (!series.length) return null;
  for (let k = 0; k < 50; k++) {
    const s = Math.floor(Math.random() * series.length);
    const bars = series[s].bars;
    const i = WINDOW - 1 + Math.floor(Math.random() * (bars.length - WINDOW));
    if (i + 1 >= bars.length) continue;
    if (Math.abs(bars[i + 1].c / bars[i].c - 1) < 1e-4) continue;
    return { s, i };
  }
  return null;
}

