import { BANDS } from "@/lib/vibe-model";

/** Half-dial 0-100 gauge, CoinMarketCap fear/greed style, drawn in ink. */
export function Gauge({ value, size = 220 }: { value: number | null; size?: number }) {
  const r = size / 2 - 14;
  const cx = size / 2;
  const cy = size / 2 + 2;
  const pt = (v: number, rr = r) => {
    const a = Math.PI * (1 - v / 100);
    return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)];
  };
  const arcs = BANDS.map((b, i) => {
    const from = i ? BANDS[i - 1].to : 0;
    const [x1, y1] = pt(from + 0.6);
    const [x2, y2] = pt(Math.min(b.to, 100) - 0.6);
    return <path key={b.to} d={`M${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2}`} stroke={b.color} strokeWidth={16} fill="none" />;
  });
  const [nx, ny] = value === null ? [cx, cy] : pt(value, r - 20);
  return (
    <svg width={size} height={size / 2 + 12} viewBox={`0 0 ${size} ${size / 2 + 12}`} role="img" aria-label={value === null ? "No reading yet" : `${Math.round(value)} of 100`}>
      {arcs}
      {value !== null && (
        <>
          <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#16130f" strokeWidth={3} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={6} fill="#16130f" />
        </>
      )}
    </svg>
  );
}
