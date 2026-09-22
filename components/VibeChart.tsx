// Score (0-100, left axis) over price (own scale, right axis) by day. Server-renderable SVG.

export interface ChartLine {
  label: string;
  color: string;
  dash?: string;
  points: { day: string; v: number | null }[];
  /** "score" lines share the fixed 0-100 axis; a "price" line gets its own scale. */
  axis: "score" | "price";
}

const W = 720;
const H = 260;
const PAD = { l: 34, r: 56, t: 12, b: 26 };

export function VibeChart({ days, lines, marker }: { days: string[]; lines: ChartLine[]; marker?: { day: string; label: string } | null }) {
  const x = (d: string) => PAD.l + (days.indexOf(d) / Math.max(1, days.length - 1)) * (W - PAD.l - PAD.r);
  const ys = (v: number) => PAD.t + (1 - v / 100) * (H - PAD.t - PAD.b);
  const prices = lines.filter((l) => l.axis === "price").flatMap((l) => l.points.map((p) => p.v).filter((v): v is number => v !== null));
  const pmin = prices.length ? Math.min(...prices) : 0;
  const pmax = prices.length ? Math.max(...prices) : 1;
  const span = pmax - pmin || pmax * 0.02 || 1;
  const yp = (v: number) => PAD.t + (1 - (v - (pmin - span * 0.08)) / (span * 1.16)) * (H - PAD.t - PAD.b);

  const path = (l: ChartLine) => {
    let d = "";
    let pen = false;
    for (const p of l.points) {
      if (!days.includes(p.day)) continue;
      if (p.v === null) {
        pen = false;
        continue;
      }
      const X = x(p.day).toFixed(1);
      const Y = (l.axis === "score" ? ys(p.v) : yp(p.v)).toFixed(1);
      d += `${pen ? "L" : "M"}${X},${Y}`;
      pen = true;
    }
    return d;
  };
  const ticks = [0, 25, 50, 75, 100];
  const labelDays = days.filter((_, i) => i % 7 === (days.length - 1) % 7);
  const fmtP = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(v >= 100 ? 0 : 2)}`);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="rw-chart" role="img" aria-label={lines.map((l) => l.label).join(" and ")}>
      {/* fear / greed bands */}
      <rect x={PAD.l} y={ys(100)} width={W - PAD.l - PAD.r} height={ys(75) - ys(100)} fill="#0b7a45" opacity={0.06} />
      <rect x={PAD.l} y={ys(25)} width={W - PAD.l - PAD.r} height={ys(0) - ys(25)} fill="#c2321c" opacity={0.06} />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={ys(t)} y2={ys(t)} stroke="#cfc5ae" strokeDasharray={t === 50 ? "" : "2 4"} />
          <text x={PAD.l - 6} y={ys(t) + 4} fontSize={10} textAnchor="end" fontFamily="var(--font-mono)" fill="#8a8272">
            {t}
          </text>
        </g>
      ))}
      {prices.length > 0 &&
        [pmin, (pmin + pmax) / 2, pmax].map((v, i) => (
          <text key={i} x={W - PAD.r + 6} y={yp(v) + 4} fontSize={10} fontFamily="var(--font-mono)" fill="#8a8272">
            {fmtP(v)}
          </text>
        ))}
      {labelDays.map((d) => (
        <text key={d} x={x(d)} y={H - 8} fontSize={10} textAnchor="middle" fontFamily="var(--font-mono)" fill="#8a8272">
          {new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}
        </text>
      ))}
      {marker && days.includes(marker.day) && (
        <g>
          <line x1={x(marker.day)} x2={x(marker.day)} y1={PAD.t} y2={H - PAD.b} stroke="#16130f" strokeDasharray="3 3" />
          <text x={x(marker.day) - 4} y={PAD.t + 10} fontSize={10} textAnchor="end" fontFamily="var(--font-mono)" fill="#4a443a">
            {marker.label}
          </text>
        </g>
      )}
      {lines.map((l) => (
        <path key={l.label} d={path(l)} fill="none" stroke={l.color} strokeWidth={l.axis === "score" ? 2.5 : 1.5} strokeDasharray={l.dash} strokeLinejoin="round" />
      ))}
    </svg>
  );
}
