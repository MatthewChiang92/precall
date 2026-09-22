import { BANDS } from "@/lib/vibe-model";

// Half-dial 0-100 meter drawn like a newspaper engraving: ink only, bands told apart
// by hatching (extremes solid, fear and greed hatched in opposite directions,
// neutral bare), a graduated scale and a needle. One per page (pattern ids are fixed).

const W = 460;
const H = 244;
const CX = W / 2;
const CY = 226;
const BAND_IN = 124;
const BAND_OUT = 168;
const SCALE = 174;

const INK = "var(--np-ink, #121212)";
const PAPER = "var(--np-paper, #f2efe7)";

const pt = (v: number, r: number): [number, number] => {
  const a = Math.PI * (1 - v / 100);
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
};
const f = (n: number) => n.toFixed(2);

function sector(from: number, to: number) {
  const [x1, y1] = pt(from, BAND_OUT);
  const [x2, y2] = pt(to, BAND_OUT);
  const [x3, y3] = pt(to, BAND_IN);
  const [x4, y4] = pt(from, BAND_IN);
  return `M${f(x1)},${f(y1)} A${BAND_OUT},${BAND_OUT} 0 0 1 ${f(x2)},${f(y2)} L${f(x3)},${f(y3)} A${BAND_IN},${BAND_IN} 0 0 0 ${f(x4)},${f(y4)} Z`;
}

function arc(from: number, to: number, r: number) {
  const [x1, y1] = pt(from, r);
  const [x2, y2] = pt(to, r);
  return `M${f(x1)},${f(y1)} A${r},${r} 0 0 1 ${f(x2)},${f(y2)}`;
}

// Extreme fear, fear, neutral, greed, extreme greed.
const FILL = ["solid", "url(#pg-fear)", "none", "url(#pg-greed)", "solid"];

export function PaperGauge({ value }: { value: number | null }) {
  const bands = BANDS.map((b, i) => ({ ...b, from: i ? BANDS[i - 1].to : 0, to: Math.min(b.to, 100), fill: FILL[i] }));
  const ticks: number[] = [];
  for (let v = 0; v <= 100; v += 2) ticks.push(v);

  let needle: string | null = null;
  if (value !== null) {
    const v = Math.max(0, Math.min(100, value));
    const a = Math.PI * (1 - v / 100);
    const [tx, ty] = pt(v, BAND_OUT - 4);
    const [bx, by] = [CX - 20 * Math.cos(a), CY + 20 * Math.sin(a)];
    const nx = 5 * Math.sin(a);
    const ny = 5 * Math.cos(a);
    needle = `M${f(tx)},${f(ty)} L${f(CX + nx)},${f(CY + ny)} L${f(bx)},${f(by)} L${f(CX - nx)},${f(CY - ny)} Z`;
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="np-gauge-svg"
      role="img"
      aria-label={value === null ? "No reading" : `Fear and greed reading ${Math.round(value)} of 100`}
    >
      <defs>
        <pattern id="pg-fear" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke={INK} strokeWidth="1.6" />
        </pattern>
        <pattern id="pg-greed" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke={INK} strokeWidth="1.6" />
        </pattern>
        {bands.map((b) => (
          <path key={b.to} id={`pg-label-${b.to}`} d={arc(b.from, b.to, (BAND_IN + BAND_OUT) / 2 - 4)} fill="none" />
        ))}
      </defs>

      {bands.map((b) => (
        <path key={b.to} d={sector(b.from, b.to)} fill={b.fill === "solid" ? INK : b.fill === "none" ? PAPER : b.fill} stroke={INK} strokeWidth={1.2} />
      ))}
      {bands.map((b) => (
        <text
          key={b.to}
          className={`np-gauge-band ${b.to - b.from < 15 ? "tight" : ""}`}
          fill={b.fill === "solid" ? PAPER : INK}
          stroke={b.fill === "solid" || b.fill === "none" ? "none" : PAPER}
          strokeWidth={5}
          paintOrder="stroke"
          strokeLinejoin="round"
        >
          <textPath href={`#pg-label-${b.to}`} startOffset="50%" textAnchor="middle">
            {b.word}
          </textPath>
        </text>
      ))}

      {/* graduated scale */}
      <path d={arc(0, 100, SCALE)} fill="none" stroke={INK} strokeWidth={1.2} />
      <path d={arc(0, 100, BAND_IN - 6)} fill="none" stroke={INK} strokeWidth={0.8} />
      {ticks.map((v) => {
        const major = v % 10 === 0;
        const [x1, y1] = pt(v, SCALE);
        const [x2, y2] = pt(v, SCALE + (major ? 11 : 5));
        return <line key={v} x1={f(x1)} y1={f(y1)} x2={f(x2)} y2={f(y2)} stroke={INK} strokeWidth={major ? 1.6 : 0.8} />;
      })}
      {ticks
        .filter((v) => v % 10 === 0)
        .map((v) => {
          const [x, y] = pt(v, SCALE + 22);
          return (
            <text key={v} x={f(x)} y={f(y + 4)} textAnchor="middle" className="np-gauge-num">
              {v}
            </text>
          );
        })}

      {needle && <path d={needle} fill={INK} stroke={PAPER} strokeWidth={1} strokeLinejoin="round" />}
      <circle cx={CX} cy={CY} r={11} fill={INK} />
      <circle cx={CX} cy={CY} r={3.5} fill={PAPER} />
    </svg>
  );
}
