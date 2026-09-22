// The Vibe index: 0-100 per company per UTC day. Pure and client-safe, so the
// method page and the UI read the same constants the computation uses.

export const WEIGHTS = { news: 40, momentum: 25, volume: 20, premium: 15 } as const;
export type Factor = keyof typeof WEIGHTS;
export const FACTORS: Factor[] = ["news", "momentum", "volume", "premium"];

export const FACTOR_LABEL: Record<Factor, string> = {
  news: "News sentiment",
  momentum: "Price momentum",
  volume: "Trading volume",
  premium: "Premium vs mark",
};

/** Headline tone gain: a materiality-weighted mean tone of ±0.3 reads as ±~40 points. */
export const NEWS_GAIN = 2.5;
/** Recency weights for today, yesterday, the day before. */
export const NEWS_RECENCY = [1, 0.5, 0.25];

export const BANDS = [
  { to: 25, word: "Extreme fear", color: "#c2321c" },
  { to: 45, word: "Fear", color: "#e0835f" },
  { to: 56, word: "Neutral", color: "#b9ae94" },
  { to: 76, word: "Greed", color: "#6fae7f" },
  { to: 101, word: "Extreme greed", color: "#0b7a45" },
];

export function band(v: number) {
  return BANDS.find((b) => v < b.to) ?? BANDS[BANDS.length - 1];
}

/** Weighted mean of the factors present, renormalised. News is required. */
export function combine(f: Partial<Record<Factor, number | null>>): { score: number | null; factors: number } {
  if (f.news === null || f.news === undefined) return { score: null, factors: 0 };
  let sum = 0;
  let w = 0;
  let n = 0;
  for (const k of FACTORS) {
    const v = f[k];
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    sum += v * WEIGHTS[k];
    w += WEIGHTS[k];
    n++;
  }
  return { score: w ? sum / w : null, factors: n };
}

// Abramowitz & Stegun 7.1.26, |error| < 1.5e-7.
function erf(x: number) {
  const s = Math.sign(x);
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}

/** Standard normal CDF, as 0-100. */
export const cdf100 = (z: number) => 50 * (1 + erf(z / Math.SQRT2));
