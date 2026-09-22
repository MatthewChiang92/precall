import Link from "next/link";
import type { ReactNode } from "react";
import { band } from "@/lib/vibe-model";

// Building blocks of the Fear & Greed newspaper. Server components, ink only.

export const PAPER_NAME = "The Fear & Greed Gazette";

const longDate = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export const shortDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Nameplate with ears, folio line and the section bar (one section per company). */
export function Masthead({
  day,
  sections,
  current,
  leftEar,
  rightEar,
}: {
  day: string;
  sections: { symbol: string; name: string }[];
  current?: string;
  leftEar: ReactNode;
  rightEar: ReactNode;
}) {
  return (
    <header className="np-mast">
      <div className="np-top">
        <div className="np-ear">{leftEar}</div>
        <Link href="/vibe" className="np-nameplate">
          {PAPER_NAME}
        </Link>
        <div className="np-ear">{rightEar}</div>
      </div>
      <div className="np-folio">
        <span>PreStocks edition</span>
        <span>{longDate(day)}</span>
        <span>Updated through the day · Free</span>
      </div>
      <nav className="np-sections" aria-label="Sections">
        <Link href="/vibe" aria-current={current ? undefined : "page"}>
          Front page
        </Link>
        {sections.map((s) => (
          <Link key={s.symbol} href={`/vibe/${s.symbol.toLowerCase()}`} aria-current={current === s.symbol ? "page" : undefined}>
            {s.name}
          </Link>
        ))}
      </nav>
    </header>
  );
}

/** A reading in words and figures: "62 · Greed". */
export function Reading({ score }: { score: number | null }) {
  if (score === null) return <span className="np-reading none">No reading</span>;
  return (
    <span className="np-reading">
      <b>{Math.round(score)}</b> {band(score).word}
    </span>
  );
}

/** Signed whole-point change between two printed readings, direction in the glyph (no colour on newsprint). */
export function Change({ now, then }: { now: number | null; then: number | null }) {
  if (now === null || then === null) return <span className="np-chg">—</span>;
  const r = Math.round(now) - Math.round(then);
  if (r === 0) return <span className="np-chg">unch</span>;
  return (
    <span className="np-chg">
      {r > 0 ? "▲" : "▼"} {Math.abs(r)}
    </span>
  );
}

/** Headline tone as the index read it. */
export function Tone({ s }: { s: number }) {
  const t = s > 0.05 ? "▲ Bullish" : s < -0.05 ? "▼ Bearish" : "Neutral";
  return <span className="np-tone">{t}</span>;
}

/** A picture, graded to black and white with a halftone screen, with its cutline. */
export function Photo({ src, alt, caption, credit, className = "" }: { src: string; alt: string; caption?: ReactNode; credit?: string; className?: string }) {
  return (
    <figure className={`np-photo ${className}`}>
      <div className="np-photo-frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" />
      </div>
      {(caption || credit) && (
        <figcaption>
          {caption}
          {credit && <span className="np-credit">{credit}</span>}
        </figcaption>
      )}
    </figure>
  );
}

/**
 * One story as the paper sets it. `author`, `image` and `dek` are optional: the
 * news store holds headline, publisher, link and date today, and the layout already
 * makes room for the rest.
 */
export interface PaperStory {
  title: string;
  url: string;
  publisher: string | null;
  publishedAt: number;
  s: number;
  hits: string[];
  author?: string | null;
  image?: string | null;
  dek?: string | null;
}

export function Story({ story, size = "brief", kicker, cues = false }: { story: PaperStory; size?: "lead" | "main" | "brief"; kicker?: ReactNode; cues?: boolean }) {
  const H = size === "brief" ? "h4" : "h3";
  return (
    <article className={`np-story ${size}`}>
      {kicker && <div className="np-kicker">{kicker}</div>}
      {story.image && size !== "brief" && <Photo src={story.image} alt="" credit={story.publisher ?? undefined} />}
      <H className="np-hed">
        <a href={story.url} target="_blank" rel="noreferrer">
          {story.title}
        </a>
      </H>
      {story.dek && size !== "brief" && <p className="np-dek">{story.dek}</p>}
      <div className="np-tone-row">
        <Tone s={story.s} />
        {cues && story.hits.length > 0 && (
          <span className="np-cues">read on {story.hits.map((h) => `${h.slice(1)} ${h[0] === "+" ? "▲" : "▼"}`).join(", ")}</span>
        )}
      </div>
      <SourceLine story={story} />
    </article>
  );
}

/** Where it came from, pinned to the foot of every story: publisher, writer, date. */
export function SourceLine({ story }: { story: Pick<PaperStory, "url" | "publisher" | "author" | "publishedAt"> }) {
  return (
    <a className="np-source" href={story.url} target="_blank" rel="noreferrer">
      <span className="k">Source</span> {story.publisher ?? "Unknown publisher"}
      {story.author ? <> · By {story.author}</> : null} · {shortDate(story.publishedAt)}
    </a>
  );
}

/** 30 daily readings as a tiny ink line, 50 marked. */
export function Trend({ xs }: { xs: (number | null)[] }) {
  const w = 96;
  const h = 22;
  let d = "";
  let pen = false;
  xs.forEach((v, i) => {
    if (v === null) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${((i / Math.max(1, xs.length - 1)) * w).toFixed(1)},${(h - 1 - (v / 100) * (h - 2)).toFixed(1)}`;
    pen = true;
  });
  return (
    <svg width={w} height={h} aria-hidden="true" className="np-trend">
      <line x1={0} x2={w} y1={h / 2} y2={h / 2} stroke="currentColor" strokeOpacity={0.35} strokeDasharray="1 2" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.3} />
    </svg>
  );
}

/**
 * The headline the numbers write: "Anthropic climbs to 62". The kicker is the band,
 * or the move between bands when it changed since yesterday.
 */
export function indexHeadline(subject: string, score: number, prev: number | null) {
  const d = prev === null ? null : Math.round(score) - Math.round(prev);
  const verb = d === null ? "stands at" : d > 0 ? "climbs to" : d < 0 ? "slips to" : "holds at";
  const now = band(score).word;
  const before = prev === null ? null : band(prev).word;
  return {
    kicker: before && before !== now ? `${before} to ${now}` : now,
    head: `${subject} ${verb} ${Math.round(score)}`,
  };
}

/** "up 4 points from yesterday", from the rounded figures the page prints. */
export function moved(now: number, then: number, since: string) {
  const r = Math.round(now) - Math.round(then);
  if (r === 0) return `unchanged from ${since}`;
  return `${r > 0 ? "up" : "down"} ${Math.abs(r)} point${Math.abs(r) === 1 ? "" : "s"} from ${since}`;
}
