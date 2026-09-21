"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { dayLabel, fmtPct, fmtPrice } from "@/lib/format";

import { type Puzzle, WINDOW, pick } from "@/lib/rewind";

type Series = { symbol: string; name: string; image: string | null; mint: string; source: string | null; bars: { t: number; c: number }[] };
type Dir = "UP" | "DOWN";

const AFTER = 5;
const BEST_KEY = "precall.rewind.best";

export function Rewind({ series, first }: { series: Series[]; first: Puzzle | null }) {
  const [pz, setPz] = useState<Puzzle | null>(first);
  const [guess, setGuess] = useState<Dir | null>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [tally, setTally] = useState({ right: 0, total: 0 });

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        setBest(Number(localStorage.getItem(BEST_KEY) ?? 0) || 0);
      } catch {}
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const answer = useCallback(
    (d: Dir) => {
      if (!pz || guess) return;
      const bars = series[pz.s].bars;
      const up = bars[pz.i + 1].c > bars[pz.i].c;
      const right = (d === "UP") === up;
      setGuess(d);
      setTally((t) => ({ right: t.right + (right ? 1 : 0), total: t.total + 1 }));
      setStreak((s) => {
        const n = right ? s + 1 : 0;
        setBest((b) => {
          const nb = Math.max(b, n);
          try {
            localStorage.setItem(BEST_KEY, String(nb));
          } catch {}
          return nb;
        });
        return n;
      });
    },
    [pz, guess, series],
  );

  const next = useCallback(() => {
    setGuess(null);
    setPz(pick(series));
  }, [series]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") answer("UP");
      else if (e.key === "ArrowDown") answer("DOWN");
      else if ((e.key === "Enter" || e.key === " ") && guess) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, next, guess]);

  if (!series.length) return <div className="empty">Price history is still loading. Try again in a minute.</div>;
  if (!pz) return <div className="empty">Dealing…</div>;

  const s = series[pz.s];
  const shown = s.bars.slice(pz.i - WINDOW + 1, pz.i + 1);
  const after = s.bars.slice(pz.i + 1, pz.i + 1 + AFTER);
  const ret = s.bars[pz.i + 1].c / s.bars[pz.i].c - 1;
  const right = guess ? (guess === "UP") === ret > 0 : null;

  // chart geometry
  const W = 640;
  const H = 280;
  const P = 16;
  const all = guess ? [...shown, ...after] : shown;
  const slots = WINDOW + AFTER;
  const cs = all.map((b) => b.c);
  const min = Math.min(...cs);
  const max = Math.max(...cs);
  const span = max - min || 1;
  const x = (k: number) => P + (k / (slots - 1)) * (W - 2 * P);
  const y = (c: number) => H - P - ((c - min) / span) * (H - 2 * P);
  const path = (pts: { c: number }[], off: number) => pts.map((b, k) => `${k ? "L" : "M"}${x(k + off).toFixed(1)},${y(b.c).toFixed(1)}`).join("");

  return (
    <div className="rw">
      <div className="panel">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {s.image && <img className="logo" src={s.image} alt="" width={38} height={38} />}
          <div>
            <div className="t-name">{s.name}</div>
            <div className="t-tick">{s.symbol} · last {WINDOW} trading days, dates hidden</div>
          </div>
          <div className="t-price">
            <div className="p">{fmtPrice(shown[shown.length - 1].c)}</div>
            <div className="c muted">last close</div>
          </div>
        </div>
        <svg className="rw-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${s.name} price chart`}>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={P} x2={W - P} y1={P + f * (H - 2 * P)} y2={P + f * (H - 2 * P)} stroke="var(--rule)" strokeDasharray="3 4" />
          ))}
          <line x1={x(WINDOW - 1)} x2={x(WINDOW - 1)} y1={P} y2={H - P} stroke="var(--ink-3)" strokeDasharray="2 3" />
          <path d={path(shown, 0)} fill="none" stroke="var(--ink)" strokeWidth={2.4} strokeLinejoin="round" />
          {guess && (
            <path
              d={`M${x(WINDOW - 1)},${y(shown[shown.length - 1].c)}` + path(after, WINDOW).replace(/^M/, "L")}
              fill="none"
              stroke={ret > 0 ? "var(--up)" : "var(--down)"}
              strokeWidth={2.4}
              strokeDasharray="6 4"
            />
          )}
          <circle cx={x(WINDOW - 1)} cy={y(shown[shown.length - 1].c)} r={5} fill="var(--hi)" stroke="var(--ink)" strokeWidth={2} />
          {guess && <circle cx={x(WINDOW)} cy={y(after[0].c)} r={5} fill={ret > 0 ? "var(--up)" : "var(--down)"} />}
        </svg>
        {guess ? (
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <div>
              <span className={`chip ${right ? "win" : "lose"}`} style={{ fontSize: 14 }}>
                {right ? "Right" : "Wrong"}
              </span>{" "}
              <span className="mono">
                next day <b className={ret > 0 ? "up" : "down"}>{fmtPct(ret)}</b>
              </span>
              <div className="muted mono" style={{ fontSize: 11, marginTop: 4 }}>
                {dayLabel(new Date(shown[shown.length - 1].t).toISOString().slice(0, 10), { day: "numeric", month: "short", year: "numeric" })} →{" "}
                {dayLabel(new Date(after[0].t).toISOString().slice(0, 10), { day: "numeric", month: "short", year: "numeric" })} · on-chain via {s.source}
              </div>
            </div>
            <button className="btn" type="button" onClick={next} autoFocus>
              Next ↵
            </button>
          </div>
        ) : (
          <div className="calls" style={{ borderTop: 0 }}>
            <button className="stamp up-btn" type="button" onClick={() => answer("UP")}>▲ Up</button>
            <button className="stamp down-btn" type="button" onClick={() => answer("DOWN")}>▼ Down</button>
          </div>
        )}
      </div>
      <div className="panel" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div className="kicker">Streak</div>
          <div className="big-num">{streak}</div>
        </div>
        <div className="statrow" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 0 }}>
          <div className="stat">
            <div className="v">{best}</div>
            <div className="k">best streak</div>
          </div>
          <div className="stat">
            <div className="v">{tally.total ? Math.round((tally.right / tally.total) * 100) : 0}%</div>
            <div className="k">
              hit rate ({tally.right}/{tally.total})
            </div>
          </div>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Keyboard: <b>↑</b> / <b>↓</b> to call, <b>Enter</b> for the next chart. Practice only, no effect on the leaderboard.
        </p>
        <Link href="/" className="btn ghost" style={{ justifyContent: "center" }}>
          Warmed up? Fill in today&apos;s slip →
        </Link>
      </div>
    </div>
  );
}
