"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { band } from "@/lib/vibe-model";

export interface VibeTableRow {
  symbol: string;
  name: string;
  image: string | null;
  /** Oldest first, one per day. */
  scores: (number | null)[];
  stories: number[];
}

type Win = 1 | 7 | 30;
type Key = "name" | "score" | "change" | "heat";

const meanOf = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

/** A 1d window is the latest daily value; 7d and 30d are means of the daily values. */
function windowScore(scores: (number | null)[], w: Win, offset = 0) {
  const end = scores.length - offset;
  if (w === 1) return scores[end - 1] ?? null;
  return meanOf(scores.slice(Math.max(0, end - w), end));
}

function Spark({ xs }: { xs: (number | null)[] }) {
  const w = 90;
  const h = 24;
  let d = "";
  let pen = false;
  xs.forEach((v, i) => {
    if (v === null) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${((i / Math.max(1, xs.length - 1)) * w).toFixed(1)},${(h - (v / 100) * h).toFixed(1)}`;
    pen = true;
  });
  return (
    <svg width={w} height={h} aria-hidden="true">
      <line x1={0} x2={w} y1={h / 2} y2={h / 2} stroke="#cfc5ae" strokeDasharray="2 3" />
      <path d={d} fill="none" stroke="#16130f" strokeWidth={1.5} />
    </svg>
  );
}

export function VibeTable({ rows }: { rows: VibeTableRow[] }) {
  const router = useRouter();
  const [win, setWin] = useState<Win>(1);
  const [sort, setSort] = useState<{ k: Key; desc: boolean }>({ k: "score", desc: true });

  const data = useMemo(() => {
    const out = rows.map((r) => {
      const score = windowScore(r.scores, win);
      const prev = windowScore(r.scores, win, win);
      const heat = r.stories.slice(-win).reduce((a, b) => a + b, 0);
      return { ...r, score, change: score !== null && prev !== null ? score - prev : null, heat };
    });
    const val = (x: (typeof out)[number]) => (sort.k === "name" ? x.name : x[sort.k]);
    return out.sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      // Nulls ("no coverage") always sink, whichever way the column is sorted.
      if (va === null) return 1;
      if (vb === null) return -1;
      const c = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return sort.desc ? -c : c;
    });
  }, [rows, win, sort]);

  const th = (k: Key, label: string, num = true) => (
    <th
      className={`sortable ${num ? "num" : ""}`}
      aria-sort={sort.k === k ? (sort.desc ? "descending" : "ascending") : "none"}
      onClick={() => setSort((s) => ({ k, desc: s.k === k ? !s.desc : k !== "name" }))}
    >
      {label} {sort.k === k ? (sort.desc ? "▼" : "▲") : ""}
    </th>
  );

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div className="seg" role="group" aria-label="Window">
          {([1, 7, 30] as Win[]).map((w) => (
            <button key={w} type="button" className={win === w ? "on" : ""} aria-pressed={win === w} onClick={() => setWin(w)}>
              {w}d
            </button>
          ))}
        </div>
        <span className="muted mono" style={{ fontSize: 11 }}>
          {win === 1 ? "today's reading" : `mean of the last ${win} daily readings`} · heat = headlines in the window
        </span>
      </div>
      <div className="panel tbl-wrap" style={{ padding: "4px 8px" }}>
        <table className="ledger">
          <thead>
            <tr>
              {th("name", "Company", false)}
              {th("score", "Fear & greed")}
              {th("change", win === 1 ? "vs yesterday" : `vs prior ${win}d`)}
              <th>30 days</th>
              {th("heat", "Heat")}
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const href = `/fear-greed/${r.symbol.toLowerCase()}`;
              const b = r.score === null ? null : band(r.score);
              return (
                <tr key={r.symbol} className="link-row" onClick={() => router.push(href)}>
                  <td>
                    <Link href={href} style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {r.image ? <img src={r.image} alt="" width={26} height={26} className="logo" style={{ width: 26, height: 26 }} /> : null}
                      <b>{r.name}</b>
                    </Link>
                  </td>
                  <td className="num">
                    {b ? (
                      <span className="vibe-chip" style={{ justifyContent: "flex-end" }}>
                        <span className="n" style={{ background: b.color }}>{Math.round(r.score!)}</span>
                        {b.word}
                      </span>
                    ) : (
                      <span className="muted">no coverage</span>
                    )}
                  </td>
                  <td className={`num ${r.change === null ? "" : r.change > 0.5 ? "up" : r.change < -0.5 ? "down" : "flat"}`}>
                    {r.change === null ? "—" : `${r.change > 0 ? "+" : r.change < 0 ? "−" : "±"}${Math.abs(Math.round(r.change))}`}
                  </td>
                  <td>
                    <Spark xs={r.scores} />
                  </td>
                  <td className="num">{r.heat}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
