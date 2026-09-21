/** Tiny inline SVG sparkline of daily closes. Server- and client-safe. */
export function Spark({ points, width = 120, height = 34 }: { points: { t: number; c: number }[]; width?: number; height?: number }) {
  if (points.length < 2) return <span className="muted mono" style={{ fontSize: 11 }}>building history</span>;
  const cs = points.map((p) => p.c);
  const min = Math.min(...cs);
  const max = Math.max(...cs);
  const span = max - min || 1;
  const x = (i: number) => (i / (points.length - 1)) * (width - 4) + 2;
  const y = (c: number) => height - 3 - ((c - min) / span) * (height - 6);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.c).toFixed(1)}`).join("");
  const up = cs[cs.length - 1] >= cs[0];
  const color = up ? "var(--up)" : "var(--down)";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={`${d}L${x(points.length - 1)},${height}L${x(0)},${height}Z`} fill={color} opacity={0.1} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(points.length - 1)} cy={y(cs[cs.length - 1])} r={2.4} fill={color} />
    </svg>
  );
}
