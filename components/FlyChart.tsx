"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dayLabel, fmtPct, fmtPrice } from "@/lib/format";
import { BuyButton } from "./BuyButton";

export type FlyRound = {
  date: string; // YYYY-MM or YYYY-MM-DD
  label: string;
  valuationUsd: number;
  raisedUsd: number | null;
  source: string;
  note?: string;
};
export type FlySeries = {
  symbol: string;
  name: string;
  image: string | null;
  mint: string;
  source: string | null;
  bars: { t: number; c: number }[];
  rounds: FlyRound[];
  /** Set when the company has listed: the course ends on the listing day's candle. */
  listing: { day: string; venue: string } | null;
};
type Series = FlySeries;

/** One pipe. Private rounds first, then the token's real daily candles. */
type Gate =
  | { kind: "round"; label: string; date: string; v: number; raised: number | null }
  | { kind: "candle"; t: number; c: number; up: boolean; event?: FlyRound };

const roundT = (d: string) => Date.parse(`${d.length === 4 ? d + "-01" : d}${d.length <= 7 ? "-01" : ""}T00:00:00Z`);

function buildCourse(s: Series): Gate[] {
  // Rounds before the first candle are pipes; a round raised while the token was
  // already trading is tagged onto that day's candle, so the course stays in order.
  const t0 = s.bars.length ? s.bars[0].t : Infinity;
  const late = s.rounds.filter((r) => roundT(r.date) >= t0);
  const rounds: Gate[] = s.rounds.filter((r) => roundT(r.date) < t0).map((r) => ({
    kind: "round",
    label: r.label,
    date: r.date,
    v: r.valuationUsd,
    raised: r.raisedUsd,
  }));
  const candles: Gate[] = s.bars.map((b, i) => ({
    kind: "candle",
    t: b.t,
    c: b.c,
    up: i === 0 ? true : b.c >= s.bars[i - 1].c,
    event: late.find((r) => {
      const t = roundT(r.date);
      return t >= b.t && (i + 1 >= s.bars.length || t < s.bars[i + 1].t);
    }),
  }));
  return [...rounds, ...candles];
}

export function fmtUsdBig(n: number): string {
  const u: [number, string][] = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [d, k] of u)
    if (n >= d) {
      const x = n / d;
      return "$" + (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1).replace(/\.0$/, "") : x.toFixed(2).replace(/\.?0+$/, "")) + k;
    }
  return "$" + n.toFixed(0);
}

export function fmtRoundDate(d: string): string {
  const [y, m] = d.split("-");
  if (!m) return y;
  return new Date(`${y}-${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}
type Phase = "ready" | "playing" | "dead" | "won";

// Logical canvas size; scaled to the container with devicePixelRatio.
const W = 420;
const H = 620;
const GROUND = 26;
const PIPE_W = 46;
const SPACING = 190;
const GAP = 168;
const SPEED = 150; // px per second
const GRAVITY = 1500; // px/s^2
const FLAP = -430; // px/s
const R = 17; // bird radius
const BIRD_X = 110;
const STEP = 1 / 120; // fixed physics step
const BEST_KEY = "precall.fly.best.v2"; // v2: courses now start at the first funding round
// Largest gap-to-gap move, in px, between two pipes (up is harder than down).
const MAX_CLIMB = 150;
const MAX_DROP = 210;

const C = {
  paper: "#f1ebdd",
  card: "#fbf8f1",
  ink: "#16130f",
  ink3: "#8a8272",
  rule: "#cfc5ae",
  up: "#0b7a45",
  upBg: "#d7ecd9",
  down: "#c2321c",
  downBg: "#f6d9d1",
  hi: "#f3d43b",
  round: "#8a6d00",
  roundBg: "#f7e8a6",
};

const dayFmt = (t: number, year = true) =>
  new Date(t).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(year ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });

function gateLine(g: Gate): string {
  return g.kind === "round"
    ? `${g.label} · ${fmtRoundDate(g.date)} · valued ${fmtUsdBig(g.v)}`
    : `${dayFmt(g.t)} · token ${fmtPrice(g.c)}`;
}

interface World {
  y: number;
  vy: number;
  x: number; // distance travelled
  passed: number;
  gaps: number[]; // gap centre (px) per bar
  t: number;
}

function scale(vals: number[], top: number, bottom: number): number[] {
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  // Higher value = higher on screen (smaller y), like a chart.
  return vals.map((v) => bottom - ((v - min) / span) * (bottom - top));
}

function gapCenters(course: Gate[]): number[] {
  const top = 40 + GAP / 2 + 30; // room for the round tags above the gap
  const bottom = H - GROUND - 40 - GAP / 2;
  // Private rounds climb on a log scale (Seed to $100B+ would flatten linearly);
  // the token's candles use the full height on a linear price scale.
  const rv = course.flatMap((g) => (g.kind === "round" ? [Math.log10(g.v)] : []));
  const cv = course.flatMap((g) => (g.kind === "candle" ? [g.c] : []));
  const raw = [...(rv.length ? scale(rv, top, bottom) : []), ...(cv.length ? scale(cv, top, bottom) : [])];
  // Ease each gap toward the real close, never faster than a bird can follow
  // between two pipes, so a violent candle bends the course without making it
  // physically impossible. The overall shape of the chart is preserved.
  const out = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    const d = raw[i] - out[i - 1];
    out.push(out[i - 1] + Math.max(-MAX_CLIMB, Math.min(MAX_DROP, d)));
  }
  return out;
}

const pipeX = (i: number, x: number) => W + 40 + i * SPACING - x;

export function FlyChart({ series }: { series: Series[] }) {
  const [pick, setPick] = useState(0);
  const [best, setBest] = useState<Record<string, number>>({});

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        setBest(JSON.parse(localStorage.getItem(BEST_KEY) ?? "{}") || {});
      } catch {}
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const onRun = useCallback((symbol: string, passed: number) => {
    setBest((b) => {
      if ((b[symbol] ?? 0) >= passed) return b;
      const nb = { ...b, [symbol]: passed };
      try {
        localStorage.setItem(BEST_KEY, JSON.stringify(nb));
      } catch {}
      return nb;
    });
  }, []);

  if (!series.length)
    return (
      <div className="empty">
        Price history is still loading. Try again in a minute.
      </div>
    );
  const s = series[pick];

  return (
    <div className="rw">
      <div className="panel" style={{ padding: 10 }}>
        <Game key={s.symbol} s={s} onRun={onRun} />
      </div>
      <Sidebar series={series} pick={pick} setPick={setPick} best={best} />
    </div>
  );
}

function Game({
  s,
  onRun,
}: {
  s: Series;
  onRun: (symbol: string, passed: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const phaseRef = useRef<Phase>("ready");
  const logo = useRef<HTMLImageElement | null>(null);
  const course = useMemo(() => buildCourse(s), [s]);
  const world = useRef<World>(null as unknown as World);
  if (world.current === null) {
    const gaps = gapCenters(course);
    world.current = { y: gaps[0], vy: 0, x: 0, passed: 0, gaps, t: 0 };
  }

  // Load the company logo for the bird.
  useEffect(() => {
    if (!s.image) return;
    const img = new Image();
    img.src = s.image;
    img.onload = () => (logo.current = img);
  }, [s.image]);

  const reset = useCallback(() => {
    const gaps = gapCenters(course);
    world.current = { y: gaps[0], vy: 0, x: 0, passed: 0, gaps, t: 0 };
    setScore(0);
  }, [course]);

  const end = useCallback(
    (won: boolean) => {
      phaseRef.current = won ? "won" : "dead";
      setPhase(phaseRef.current);
      onRun(s.symbol, world.current.passed);
    },
    [s, onRun],
  );

  const flap = useCallback(() => {
    if (phaseRef.current === "ready") {
      phaseRef.current = "playing";
      setPhase("playing");
    }
    if (phaseRef.current === "playing" && world.current)
      world.current.vy = FLAP;
  }, []);

  const restart = useCallback(() => {
    reset();
    phaseRef.current = "ready";
    setPhase("ready");
  }, [reset]);

  // Input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === "ArrowUp") {
        e.preventDefault();
        if (phaseRef.current === "dead" || phaseRef.current === "won")
          restart();
        else flap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flap, restart]);

  // Game loop: fixed-step physics, render every frame.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr;
    cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Canvas cannot resolve CSS variables, so read the loaded next/font families once.
    const css = getComputedStyle(document.documentElement);
    const fDisplay = css.getPropertyValue("--font-display").trim() || "Impact";
    const fMono = css.getPropertyValue("--font-mono").trim() || "monospace";

    // Dev-only handle so the autopilot test can read the world. Never in production.
    if (process.env.NODE_ENV !== "production") (window as unknown as { __fly: unknown }).__fly = { world, phaseRef, pipeX, SPACING, PIPE_W, BIRD_X, GAP };

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const n = course.length;
    const nRounds = course.filter((g) => g.kind === "round").length;

    const stepPhysics = (dt: number) => {
      const w = world.current!;
      w.t += dt;
      if (phaseRef.current === "ready") {
        w.y = w.gaps[0] + Math.sin(w.t * 4) * 8;
        return;
      }
      if (phaseRef.current !== "playing") {
        // fall to the ground after a crash
        if (w.y < H - GROUND - R) {
          w.vy += GRAVITY * dt;
          w.y = Math.min(H - GROUND - R, w.y + w.vy * dt);
        }
        return;
      }
      w.vy += GRAVITY * dt;
      w.y += w.vy * dt;
      w.x += SPEED * dt;
      if (w.y > H - GROUND - R || w.y < R) return end(false);
      for (let i = w.passed; i < Math.min(n, w.passed + 3); i++) {
        const px = pipeX(i, w.x);
        if (px > BIRD_X + R || px + PIPE_W < BIRD_X - R) {
          if (px + PIPE_W < BIRD_X - R && i === w.passed) {
            w.passed++;
            setScore(w.passed);
            if (w.passed >= n) return end(true);
          }
          continue;
        }
        const g = w.gaps[i];
        // circle vs the two pipe rects: nearest point on each rect within R = hit
        const nx = Math.max(px, Math.min(BIRD_X, px + PIPE_W));
        const topY = g - GAP / 2;
        const botY = g + GAP / 2;
        const hitTop = Math.hypot(BIRD_X - nx, w.y - Math.min(w.y, topY)) < R;
        const hitBot = Math.hypot(BIRD_X - nx, w.y - Math.max(w.y, botY)) < R;
        if (hitTop || hitBot) return end(false);
      }
    };

    const marker = (x: number, text: string, color: string) => {
      ctx.save();
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, 110);
      ctx.lineTo(x, H - GROUND);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.translate(x - 8, H - GROUND - 12);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = color;
      ctx.font = `900 16px ${fDisplay}`;
      ctx.textAlign = "left";
      ctx.fillText(text, 0, 0);
      ctx.restore();
    };

    const draw = () => {
      const w = world.current!;
      ctx.fillStyle = C.paper;
      ctx.fillRect(0, 0, W, H);
      // ledger lines
      ctx.strokeStyle = "rgba(90,75,40,0.07)";
      ctx.lineWidth = 1;
      for (let y = 32; y < H; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(W, y + 0.5);
        ctx.stroke();
      }

      // the real price path through the gaps
      ctx.setLineDash([5, 6]);
      ctx.strokeStyle = C.ink3;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let started = false;
      for (
        let i = Math.max(0, w.passed - 3);
        i < Math.min(n, w.passed + 5);
        i++
      ) {
        const cx = pipeX(i, w.x) + PIPE_W / 2;
        if (!started) {
          ctx.moveTo(cx, w.gaps[i]);
          started = true;
        } else ctx.lineTo(cx, w.gaps[i]);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // candle pipes
      for (
        let i = Math.max(0, w.passed - 2);
        i < Math.min(n, w.passed + 4);
        i++
      ) {
        const px = pipeX(i, w.x);
        if (px > W || px + PIPE_W < 0) continue;
        const gate = course[i];
        const g = w.gaps[i];
        const fill = gate.kind === "round" ? C.roundBg : gate.up ? C.upBg : C.downBg;
        const edge = gate.kind === "round" ? C.round : gate.up ? C.up : C.down;
        const rects: [number, number][] = [
          [0, g - GAP / 2],
          [g + GAP / 2, H - GROUND - (g + GAP / 2)],
        ];
        for (const [y, h] of rects) {
          ctx.fillStyle = fill;
          ctx.fillRect(px, y, PIPE_W, h);
          ctx.strokeStyle = C.ink;
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 1, y, PIPE_W - 2, h);
          // wick
          ctx.strokeStyle = edge;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(px + PIPE_W / 2, y + 6);
          ctx.lineTo(px + PIPE_W / 2, y + h - 6);
          ctx.stroke();
        }
        // lip caps
        ctx.fillStyle = C.ink;
        ctx.fillRect(px - 4, g - GAP / 2 - 10, PIPE_W + 8, 10);
        ctx.fillRect(px - 4, g + GAP / 2, PIPE_W + 8, 10);
        // funding-round tag: stage + post-money valuation, pinned above the gap
        const tag = gate.kind === "round" ? { label: gate.label, v: gate.v } : gate.event ? { label: gate.event.label, v: gate.event.valuationUsd } : null;
        if (tag) {
          const tw = 92;
          const ty = g - GAP / 2 - 52;
          ctx.fillStyle = C.card;
          ctx.fillRect(px + PIPE_W / 2 - tw / 2, ty, tw, 36);
          ctx.strokeStyle = C.ink;
          ctx.lineWidth = 2;
          ctx.strokeRect(px + PIPE_W / 2 - tw / 2, ty, tw, 36);
          ctx.fillStyle = C.ink;
          ctx.textAlign = "center";
          ctx.font = `900 13px ${fDisplay}`;
          ctx.fillText(tag.label.toUpperCase().slice(0, 14), px + PIPE_W / 2, ty + 15);
          ctx.font = `600 11px ${fMono}`;
          ctx.fillText(fmtUsdBig(tag.v), px + PIPE_W / 2, ty + 30);
        }
      }

      // the moment the PreStocks token went live: between the last round and first candle
      if (nRounds > 0 && nRounds < n) {
        const lx = (pipeX(nRounds - 1, w.x) + PIPE_W + pipeX(nRounds, w.x)) / 2;
        if (lx > -40 && lx < W + 40) marker(lx, "PRESTOCKS TOKEN · ON-CHAIN", C.ink);
      }
      // finish: the listing bell, or an open question
      const fx = pipeX(n, w.x) + PIPE_W / 2 - SPACING / 2 + 40;
      if (fx > -40 && fx < W + 40) marker(fx, s.listing ? `IPO · ${s.listing.venue}` : "IPO: NOT YET", s.listing ? C.up : C.down);

      // ground
      ctx.fillStyle = C.ink;
      ctx.fillRect(0, H - GROUND, W, GROUND);
      ctx.fillStyle = C.hi;
      for (let x = -((w.x * 1) % 24); x < W; x += 24)
        ctx.fillRect(x, H - GROUND + 10, 12, 4);

      // bird
      const rot = Math.max(-0.5, Math.min(1.1, w.vy / 700));
      ctx.save();
      ctx.translate(BIRD_X, w.y);
      ctx.rotate(rot);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fill();
      if (logo.current) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, R - 1, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(logo.current, -R, -R, R * 2, R * 2);
        ctx.restore();
      }
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = C.ink;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.stroke();
      // wing
      ctx.fillStyle = C.hi;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      const flapUp = phaseRef.current === "playing" && w.vy < 0;
      ctx.beginPath();
      ctx.ellipse(
        -R + 2,
        flapUp ? -4 : 5,
        10,
        6,
        flapUp ? -0.5 : 0.4,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // HUD
      const idx = Math.min(n - 1, w.passed);
      ctx.fillStyle = C.ink;
      ctx.font = `900 54px ${fDisplay}`;
      ctx.textAlign = "center";
      ctx.fillText(String(w.passed), W / 2, 70);
      ctx.font = `500 12px ${fMono}`;
      ctx.fillText(gateLine(course[idx]), W / 2, 92);
    };

    const frame = (now: number) => {
      acc += Math.min(0.1, (now - last) / 1000);
      last = now;
      while (acc >= STEP) {
        stepPhysics(STEP);
        acc -= STEP;
      }
      draw();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [s, course, end]);

  const firstRound = course.find((g) => g.kind === "round");
  const firstCandle = course.find((g) => g.kind === "candle");
  const at = course[Math.min(course.length - 1, Math.max(0, score - 1))];
  const lastRound = [...course.slice(0, Math.max(1, score))].reverse().find((g) => g.kind === "round");

  let story: React.ReactNode = null;
  if (at && at.kind === "round" && firstRound && firstRound.kind === "round")
    story = (
      <>
        You got {s.name} to its {at.label} ({fmtRoundDate(at.date)}), valued {fmtUsdBig(at.v)}
        {at !== firstRound && <> — <b className="up">{fmtMultiple(at.v / firstRound.v)}</b> its {firstRound.label} valuation</>}.
      </>
    );
  else if (at && at.kind === "candle" && firstCandle && firstCandle.kind === "candle")
    story = (
      <>
        {lastRound && lastRound.kind === "round" && <>Past every private round to {fmtUsdBig(lastRound.v)}, then </>}
        {lastRound ? "t" : "T"}he token from {dayFmt(firstCandle.t, false)} to {dayFmt(at.t, false)}:{" "}
        <b className={at.c >= firstCandle.c ? "up" : "down"}>{fmtPct(at.c / firstCandle.c - 1, 1)}</b>
      </>
    );

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: W,
        margin: "0 auto",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          aspectRatio: `${W} / ${H}`,
          display: "block",
          border: `2px solid ${C.ink}`,
          borderRadius: 4,
          touchAction: "none",
          cursor: "pointer",
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          if (phase === "dead" || phase === "won") return;
          flap();
        }}
        aria-label={`Fly ${s.name} from its first funding round to ${s.listing ? "its IPO" : "today"}. Tap or press space to flap.`}
        role="img"
      />
      {phase === "ready" && (
        <div className="fly-overlay" style={{ pointerEvents: "none" }}>
          <div className="t-name">{s.name}: seed to IPO</div>
          <div className="mono" style={{ fontSize: 12, maxWidth: 300 }}>
            {course.filter((g) => g.kind === "round").length} funding rounds, then {s.bars.length} real daily token candles
            {s.listing ? " to the listing bell" : ""} · tap / space to flap
          </div>
        </div>
      )}
      {(phase === "dead" || phase === "won") && (
        <div className="fly-overlay">
          <div className="kicker">
            {phase === "won" ? (s.listing ? `Bell rung · ${s.listing.venue}` : "You reached today") : "Crashed"}
          </div>
          <div className="big-num">{score}</div>
          <div className="mono" style={{ fontSize: 12.5, maxWidth: 320 }}>
            {story}
          </div>
          {phase === "won" && (
            <div className="mono" style={{ fontSize: 12.5, maxWidth: 320, marginTop: 6 }}>
              {s.listing
                ? `${s.name} listed on ${dayLabel(s.listing.day, { day: "numeric", month: "short", year: "numeric" })}.`
                : `${s.name} hasn't IPO'd yet. Nobody knows how its flight ends.`}
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 10,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <button className="btn" type="button" onClick={restart} autoFocus>
              Fly again
            </button>
            <Link className="btn ghost" href="/">
              Call {s.symbol} for next week
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function fmtMultiple(x: number): string {
  return x >= 10 ? `${Math.round(x).toLocaleString("en-US")}×` : `${x.toFixed(1)}×`;
}

function Sidebar({
  series,
  pick,
  setPick,
  best,
}: {
  series: Series[];
  pick: number;
  setPick: (i: number) => void;
  best: Record<string, number>;
}) {
  const s = series[pick];
  return (
    <div
      className="panel"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div className="kicker">Pick your company</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {series.map((x, i) => (
          <button
            key={x.symbol}
            type="button"
            className={`stamp ${i === pick ? "picked up-btn" : ""}`}
            style={{
              fontSize: 17,
              padding: "8px 6px 6px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              justifyContent: "flex-start",
            }}
            onClick={() => setPick(i)}
          >
            {x.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={x.image}
                alt=""
                width={22}
                height={22}
                style={{
                  borderRadius: "50%",
                  border: "1.5px solid #16130f",
                  background: "#fff",
                }}
              />
            )}
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {x.name}
            </span>
            <span className="mono" style={{ marginLeft: "auto", fontSize: 11 }}>
              {best[x.symbol] ?? 0}
            </span>
          </button>
        ))}
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        <b>Gold pipes are real funding rounds</b>, climbing with the company&apos;s
        valuation (log scale). Then come the PreStocks token&apos;s{" "}
        <b>real on-chain daily candles</b>: the gap follows the
        close, green up, red down. On violent days the gap eases toward the
        close so every course stays flyable. Numbers are your best run.
      </p>
      <details className="fly-rounds">
        <summary className="kicker">
          {s.name}&apos;s rounds &amp; sources ({s.rounds.length})
        </summary>
        <ul>
          {s.rounds.map((r) => (
            <li key={r.date + r.label}>
              <span className="mono">{fmtRoundDate(r.date)}</span> · {r.label} · <b>{fmtUsdBig(r.valuationUsd)}</b>
              {r.raisedUsd ? <> · raised {fmtUsdBig(r.raisedUsd)}</> : null}{" "}
              <a href={r.source} target="_blank" rel="noreferrer">
                source
              </a>
              {r.note && <div className="muted">{r.note}</div>}
            </li>
          ))}
        </ul>
        <div className="muted">Valuations as reported (post-money unless noted). Rounds without a reported valuation are left out.</div>
      </details>
      <BuyButton
        className="btn buy"
        label={`Buy ${s.name} on Jupiter`}
        token={{ symbol: s.symbol, name: s.name, mint: s.mint, image: s.image, url: null, price: null, premium: null }}
      />
    </div>
  );
}
