"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fmtPct, fmtPrice, jupiterUrl } from "@/lib/format";
import { FACTS, IPO, type PBar, SOURCES, SPLIT_EFFECTIVE, at } from "@/lib/ipo";

type Line = { bars: PBar[]; color: string; label: string; width?: number };
type Mark = { t: number; label: string };

const DAY = 86_400_000;
const TOK = "#16130f";
const SPX = "#1f5fbf";

// Decision points, all on-chain daily closes (per post-split share).
const T_A = Date.UTC(2026, 5, 11); // eve of the listing
const T_B = Date.UTC(2026, 5, 14); // first weekend after the bell
const tokA = at(IPO.token.daily, T_A)!;
const tokB = at(IPO.token.daily, T_B)!;
const tokL = IPO.token.daily[IPO.token.daily.length - 1];
const spxL = IPO.spcxx.daily[IPO.spcxx.daily.length - 1];
const tokBell = at(IPO.token.daily, IPO.listingStart)!;
const spxBell = at(IPO.spcxx.daily, IPO.listingStart)!;
const spxB = at(IPO.spcxx.daily, T_B)!;

const dFmt = (t: number, opt: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Date(t).toLocaleDateString("en-GB", { ...opt, timeZone: "UTC" });
const hFmt = (t: number) => new Date(t).toISOString().slice(11, 16) + " UTC";
const usd = (n: number) => (n < 0 ? "−" : "") + "$" + Math.abs(Math.round(n)).toLocaleString("en-US");
const gap = (tok: number, spx: number) => tok / spx - 1;
/** "31%": how far the token sits below the stock. */
const disc = (g: number) => `${Math.round(-g * 100)}%`;

type A = "hold" | "sell";
type B = "sell" | "hold" | "double" | "buy" | "out";

function outcome(a: A, b: B) {
  const k = 1000;
  const p0 = tokA.c;
  const p2 = tokB.c;
  const pN = tokL.c;
  if (a === "hold") {
    if (b === "sell") return { invested: k, value: (k * p2) / p0, line: `Held through the bell, sold on ${dFmt(T_B)}.` };
    if (b === "double")
      return {
        invested: 2 * k,
        value: (k * pN) / p0 + (k * pN) / p2,
        line: `Held through the bell and bought another $1,000 at the discount on ${dFmt(T_B)}.`,
      };
    return { invested: k, value: (k * pN) / p0, line: "Held through the bell and never sold." };
  }
  if (b === "buy") return { invested: k, value: (k * pN) / p2, line: `Sold before the bell, bought back in on ${dFmt(T_B)}.` };
  return { invested: k, value: k, line: "Sold before the bell and stayed out." };
}

export function IpoReplay() {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<A | null>(null);
  const [b, setB] = useState<B | null>(null);

  const go = (n: number) => {
    setStep(n);
    if (typeof window !== "undefined") document.getElementById("replay")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div id="replay" style={{ display: "flex", flexDirection: "column", gap: 18, scrollMarginTop: 80 }}>
      <Progress step={step} />
      {step === 0 && (
        <Chapter
          kicker={`Chapter 1 · ${dFmt(IPO.token.daily[0].t)} – ${dFmt(T_A)}`}
          title="Before the bell"
          chart={
            <Chart
              lines={[{ bars: IPO.token.daily.filter((x) => x.t <= T_A), color: TOK, label: "SPACEX PreStocks token" }]}
              x0={IPO.token.daily[0].t}
              x1={T_A + DAY}
              level={{ v: FACTS.ipoPrice, label: `IPO price $${FACTS.ipoPrice}` }}
              marks={[{ t: SPLIT_EFFECTIVE, label: "5-for-1 split lands on-chain" }]}
            />
          }
        >
          <p>
            In the three weeks before the listing, the PreStocks token slid from {fmtPrice(IPO.token.daily[0].c)} to{" "}
            <b>{fmtPrice(tokA.c)} a share</b>. SpaceX shareholders approved a 5-for-1 split in May <Src s={SOURCES.splitVote} />, and
            PreStocks applied it <b>on Solana itself</b>: on 10 June at 04:30 UTC the token&apos;s Token-2022 display multiplier
            went from 1 to 5, so every holder&apos;s wallet showed five times as many tokens at a fifth of the price{" "}
            <Src s={SOURCES.splitOnChain} />.
          </p>
          <p>
            On 11 June at 19:30 UTC SpaceX priced its IPO at <b>${FACTS.ipoPrice}</b> <Src s={SOURCES.ipoPrice} />. The token closed
            that day at {fmtPrice(tokA.c)}, <b>{fmtPct(tokA.c / FACTS.ipoPrice - 1, 1)}</b> above it. Four days earlier PreStocks
            had posted that shares held by its SPV would be locked up for about {FACTS.lockupMonths} months after the listing, and
            that the token would trade at a discount until they unlocked <Src s={SOURCES.lockup} />.
          </p>
          <Decision
            q="You hold $1,000 of the token. The bell rings tomorrow. What do you do?"
            options={[
              { k: "hold", label: "Hold through the bell" },
              { k: "sell", label: "Sell before the bell" },
            ]}
            value={a}
            onPick={(k) => setA(k as A)}
          />
          <Nav next={a ? () => go(1) : undefined} nextLabel="Ring the bell →" />
        </Chapter>
      )}

      {step === 1 && (
        <Chapter
          kicker={`Chapter 2 · Friday ${dFmt(IPO.listingStart, { day: "numeric", month: "long", year: "numeric" })}`}
          title="The bell, hour by hour"
          chart={
            <Chart
              lines={[
                { bars: IPO.token.hourly.filter((x) => x.t >= T_A + DAY / 2 && x.t < IPO.listingStart + DAY), color: TOK, label: "SPACEX token" },
                { bars: IPO.spcxx.hourly.filter((x) => x.t < IPO.listingStart + DAY), color: SPX, label: "SPCXx (tokenized SPCX)" },
              ]}
              x0={T_A + DAY / 2}
              x1={IPO.listingStart + DAY}
              hourly
              animate
              level={{ v: FACTS.ipoPrice, label: `IPO $${FACTS.ipoPrice}` }}
              marks={[
                { t: T_A + (19.5 * DAY) / 24, label: "IPO priced" },
                { t: IPO.usOpen, label: "US market opens, 13:30 UTC" },
              ]}
            />
          }
        >
          <p>
            The token dipped on the afternoon of 11 June, then climbed back once the $135 price was announced. On Friday,
            SPCX opened on Nasdaq and <b>closed its first day at ${FACTS.firstDayClose}</b>, about{" "}
            {Math.round((FACTS.firstDayClose / FACTS.ipoPrice - 1) * 100)}% above the IPO price <Src s={SOURCES.firstDay} />. The PreStocks
            token went the other way: steady until the US morning, then it slid from about {fmtPrice(tokA.c)} to{" "}
            <b>{fmtPrice(tokBell.c)}</b> by midnight UTC, <b className="down">{fmtPct(tokBell.c / tokA.c - 1, 1)}</b> on the day.
          </p>
          <p>
            By midnight the token traded <b className="down">{disc(gap(tokBell.c, spxBell.c))} below</b> SPCXx, the tokenized
            public stock, on the same per-share basis. <b>The stock popped. The pre-IPO token dropped.</b>
          </p>
          <Result a={a!} partial />
          <Nav back={() => go(0)} next={() => go(2)} nextLabel="Why did that happen? →" />
        </Chapter>
      )}

      {step === 2 && (
        <Chapter
          kicker="Chapter 3 · The lockup"
          title="Why a pre-IPO token can fall on IPO day"
          chart={
            <Chart
              lines={[
                { bars: IPO.token.daily.filter((x) => x.t <= T_B), color: TOK, label: "SPACEX token" },
                { bars: IPO.spcxx.daily.filter((x) => x.t <= T_B), color: SPX, label: "SPCXx" },
              ]}
              x0={IPO.token.daily[0].t}
              x1={T_B + DAY}
              level={{ v: FACTS.ipoPrice, label: `IPO $${FACTS.ipoPrice}` }}
              marks={[{ t: IPO.listingStart, label: "Listing day" }]}
              shade
            />
          }
        >
          <ol className="ipo-list">
            <li>
              <b>The token is backed by real shares, held by an SPV.</b> After an IPO, existing shareholders are usually locked up:
              they can&apos;t sell for months. PreStocks said the SPV&apos;s SpaceX shares unlock in tranches over about{" "}
              {FACTS.lockupMonths} months <Src s={SOURCES.lockup} />.
            </li>
            <li>
              <b>Until then, a token holder can&apos;t turn the token into the stock.</b> After the unlock, PreStocks says it
              converts 1:1 into SPCXx, the tokenized public stock <Src s={SOURCES.lockup} />. Today, anyone who wants out has to
              sell to another buyer on-chain.
            </li>
            <li>
              <b>So the market prices in the wait.</b> Money you can&apos;t move for months is worth less than money you can move
              today. That gap is the discount, and it opened the day the stock started trading.
            </li>
          </ol>
          <p>
            By Sunday {dFmt(T_B)} the token was at {fmtPrice(tokB.c)} a share against {fmtPrice(spxB.c)} for SPCXx:{" "}
            <b className="down">a {disc(gap(tokB.c, spxB.c))} discount</b>.
          </p>
          <Decision
            q={a === "hold" ? "You're still holding. Now what?" : "You're in cash. Now what?"}
            options={
              a === "hold"
                ? [
                    { k: "sell", label: "Cut it: sell now" },
                    { k: "hold", label: "Hold and wait for the unlock" },
                    { k: "double", label: "Buy another $1,000 at the discount" },
                  ]
                : [
                    { k: "buy", label: "Buy back in at the discount" },
                    { k: "out", label: "Stay out" },
                  ]
            }
            value={b}
            onPick={(k) => setB(k as B)}
          />
          <Nav back={() => go(1)} next={b ? () => go(3) : undefined} nextLabel="Fast-forward to today →" />
        </Chapter>
      )}

      {step === 3 && (
        <Chapter
          kicker={`Chapter 4 · ${dFmt(IPO.listingStart)} – ${dFmt(tokL.t)}`}
          title="The long wait"
          chart={
            <Chart
              lines={[
                { bars: IPO.token.daily.filter((x) => x.t >= IPO.listingStart), color: TOK, label: "SPACEX token" },
                { bars: IPO.spcxx.daily, color: SPX, label: "SPCXx" },
              ]}
              x0={IPO.listingStart - DAY}
              x1={tokL.t + DAY}
              animate
              shade
            />
          }
        >
          <p>
            Since the bell the token has tracked the stock, down with it and up with it, but always below it. The gap has run
            between {disc(maxGap)} and {disc(minGap)} below. On {dFmt(tokL.t)} it closed at <b>{fmtPrice(tokL.c)}</b> against{" "}
            {fmtPrice(spxL.c)} for SPCXx: <b className="down">a {disc(gap(tokL.c, spxL.c))} discount</b>.
          </p>
          <p>
            <b>There is a deadline.</b> PreStocks says SpaceX tokens must be swapped into SPCXx or any other token before{" "}
            {FACTS.swapDeadline}, or they expire worthless <Src s={SOURCES.deadline} />.
          </p>
          <Result a={a!} b={b!} />
          <Nav back={() => go(2)} next={() => go(4)} nextLabel="What it means →" />
        </Chapter>
      )}

      {step === 4 && <Lessons onRestart={() => (setA(null), setB(null), go(0))} />}
    </div>
  );
}

const gaps = IPO.token.daily
  .filter((x) => x.t >= IPO.listingStart)
  .flatMap((x) => {
    const s = IPO.spcxx.daily.find((y) => y.t === x.t);
    return s ? [gap(x.c, s.c)] : [];
  });
const minGap = Math.min(...gaps);
const maxGap = Math.max(...gaps);

function Result({ a, b, partial }: { a: A; b?: B; partial?: boolean }) {
  if (partial) {
    const v = a === "hold" ? (1000 * tokBell.c) / tokA.c : 1000;
    return (
      <div className="ipo-result">
        <div className="kicker">Your $1,000 after the bell</div>
        <div className="big-num">{usd(v)}</div>
        <div className="mono" style={{ fontSize: 12.5 }}>
          {a === "hold" ? "You held. The bell cost you " + usd(1000 - v) + "." : "You sold at the top of the pre-IPO market. Nice."}
        </div>
      </div>
    );
  }
  const o = outcome(a, b!);
  const pnl = o.value - o.invested;
  const ref = (1000 * spxL.c) / FACTS.ipoPrice;
  return (
    <div className="ipo-result">
      <div className="kicker">Your result, marked to {dFmt(tokL.t)}</div>
      <div className="big-num">{usd(o.value)}</div>
      <div className="mono" style={{ fontSize: 12.5 }}>
        {o.line} Invested {usd(o.invested)}:{" "}
        <b className={pnl >= 0 ? "up" : "down"}>
          {pnl >= 0 ? "+" : "−"}
          {usd(Math.abs(pnl))} ({fmtPct(pnl / o.invested, 1)})
        </b>
      </div>
      <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
        For reference: $1,000 of the stock at the ${FACTS.ipoPrice} IPO price would be worth {usd(ref)} (SPCXx on-chain,{" "}
        {dFmt(spxL.t)}). Past prices, not advice.
      </div>
    </div>
  );
}

function Lessons({ onRestart }: { onRestart: () => void }) {
  return (
    <Chapter kicker="Chapter 5 · What SpaceX taught us" title="Three things to know before a company IPOs">
      <ol className="ipo-list">
        <li>
          <b>A pre-IPO price is a bet on the listing, not the listing itself.</b> The token priced SpaceX above its IPO price
          the night before, and still fell on the day the stock rose.
        </li>
        <li>
          <b>Lockups matter.</b> Pre-IPO shares usually can&apos;t be sold for months after the bell. A token backed by those
          shares inherits the wait, and the market charges for it.
        </li>
        <li>
          <b>Read the conversion rules.</b> For SpaceX the path is a 1:1 conversion into SPCXx after the unlock, with a hard
          swap deadline of {FACTS.swapDeadline} <Src s={SOURCES.deadline} />.
        </li>
      </ol>
      <p>
        Seven PreStocks companies haven&apos;t rung the bell yet: Anthropic, OpenAI, Anduril, Neuralink, Figure AI, Kalshi and
        Polymarket. Every one of them will face the same questions.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link className="btn" href="/">
          Call the other seven in PreCall
        </Link>
        <Link className="btn ghost" href="/fly">
          Fly SpaceX from seed to IPO
        </Link>
        <a className="btn ghost" href="https://prestocks.com/spacex" target="_blank" rel="noreferrer">
          SpaceX on PreStocks ↗
        </a>
        <a className="btn ghost" href={jupiterUrl(IPO.mint)} target="_blank" rel="noreferrer">
          Trade SPACEX on Jupiter ↗
        </a>
        <button className="btn ghost" type="button" onClick={onRestart}>
          Replay from the start
        </button>
      </div>
      <p className="muted" style={{ fontSize: 12.5 }}>
        <b>Data.</b> All prices are on-chain Solana trades, shown per post-split share (the raw token price ÷ 5). Token: daily
        closes to 14 Jun and hourly bars on 11–13 Jun from the deepest SPACEX/USDC pool <Src s={SOURCES.tokenPool} />, then
        GMGN&apos;s token-level daily closes across all pools. SPCXx: its deepest SPCXx/USDC pool <Src s={SOURCES.spcxxPool} />,
        then GMGN. Snapshot taken {dFmt(Date.parse(IPO.generatedAt), { day: "numeric", month: "short", year: "numeric" })}.
      </p>
    </Chapter>
  );
}

/* ---------------------------------------------------------------- pieces */

function Progress({ step }: { step: number }) {
  const names = ["Before", "The bell", "Lockup", "Today", "Lessons"];
  return (
    <div className="ipo-progress" aria-label={`Chapter ${step + 1} of ${names.length}`}>
      {names.map((n, i) => (
        <span key={n} className={i === step ? "on" : i < step ? "done" : ""}>
          {n}
        </span>
      ))}
    </div>
  );
}

function Chapter({
  kicker,
  title,
  chart,
  children,
}: {
  kicker: string;
  title: string;
  chart?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="panel ipo-chapter">
      <div className="kicker">{kicker}</div>
      <h2 className="h-section" style={{ margin: "2px 0 10px" }}>
        {title}
      </h2>
      {chart}
      <div className="prose" style={{ maxWidth: 720 }}>
        {children}
      </div>
    </section>
  );
}

function Decision({
  q,
  options,
  value,
  onPick,
}: {
  q: string;
  options: { k: string; label: string }[];
  value: string | null;
  onPick: (k: string) => void;
}) {
  return (
    <div className="ipo-decision">
      <div className="t-name" style={{ fontSize: 21 }}>
        {q}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        {options.map((o) => (
          <button
            key={o.k}
            type="button"
            className={`stamp ${value === o.k ? "picked up-btn" : ""}`}
            style={{ fontSize: 17, padding: "8px 12px 6px" }}
            onClick={() => onPick(o.k)}
            aria-pressed={value === o.k}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Nav({ back, next, nextLabel }: { back?: () => void; next?: () => void; nextLabel: string }) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
      {back && (
        <button className="btn ghost" type="button" onClick={back}>
          ← Back
        </button>
      )}
      <button className="btn" type="button" onClick={next} disabled={!next}>
        {next ? nextLabel : "Make your call to continue"}
      </button>
    </div>
  );
}

function Src({ s }: { s: { label: string; url: string } }) {
  return (
    <a className="src" href={s.url} target="_blank" rel="noreferrer" title={s.label}>
      [{s.label}]
    </a>
  );
}

/* ---------------------------------------------------------------- chart */

const CW = 760;
const CH = 330;
const PAD = { l: 58, r: 16, t: 20, b: 34 };

function Chart({
  lines,
  x0,
  x1,
  level,
  marks = [],
  hourly,
  animate,
  shade,
}: {
  lines: Line[];
  x0: number;
  x1: number;
  level?: { v: number; label: string };
  marks?: Mark[];
  hourly?: boolean;
  animate?: boolean;
  shade?: boolean;
}) {
  const [p, setP] = useState(animate ? 0 : 1);
  useEffect(() => {
    if (!animate) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const start = performance.now();
    const dur = reduce ? 1 : 4200;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      setP(k);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animate]);

  const { y, yTicks, xTicks } = useMemo(() => {
    const vals = lines.flatMap((l) => l.bars.map((b) => b.c)).concat(level ? [level.v] : []);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    const padV = (hi - lo) * 0.08 || 1;
    lo -= padV;
    hi += padV;
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (CH - PAD.t - PAD.b);
    const stepV = niceStep((hi - lo) / 5);
    const yTicks: number[] = [];
    for (let v = Math.ceil(lo / stepV) * stepV; v <= hi; v += stepV) yTicks.push(v);
    const span = x1 - x0;
    const stepT = hourly ? 6 * 3_600_000 : span > 60 * DAY ? 14 * DAY : span > 10 * DAY ? 7 * DAY : DAY;
    const xTicks: number[] = [];
    for (let t = Math.ceil(x0 / stepT) * stepT; t <= x1; t += stepT) xTicks.push(t);
    return { y, yTicks, xTicks };
  }, [lines, level, x0, x1, hourly]);

  const x = (t: number) => PAD.l + ((t - x0) / (x1 - x0)) * (CW - PAD.l - PAD.r);
  const cut = x0 + (x1 - x0) * p;
  const path = (bars: PBar[]) =>
    bars
      .filter((b) => b.t <= cut)
      .map((b, i) => `${i ? "L" : "M"}${x(b.t).toFixed(1)},${y(b.c).toFixed(1)}`)
      .join("");

  // shaded gap between token (lines[0]) and stock (lines[1]) on shared timestamps
  let shadePath = "";
  if (shade && lines.length >= 2) {
    const m = new Map(lines[1].bars.map((b) => [b.t, b.c]));
    const pts = lines[0].bars.filter((b) => m.has(b.t) && b.t <= cut);
    if (pts.length > 1)
      shadePath =
        pts.map((b, i) => `${i ? "L" : "M"}${x(b.t).toFixed(1)},${y(m.get(b.t)!).toFixed(1)}`).join("") +
        [...pts].reverse().map((b) => `L${x(b.t).toFixed(1)},${y(b.c).toFixed(1)}`).join("") +
        "Z";
  }

  const lastVis = (bars: PBar[]) => [...bars].reverse().find((b) => b.t <= cut);

  return (
    <figure style={{ margin: "0 0 12px" }}>
      <svg viewBox={`0 0 ${CW} ${CH}`} className="rw-chart" role="img" aria-label={lines.map((l) => l.label).join(" vs ")}>
        <rect x={0} y={0} width={CW} height={CH} fill="var(--card)" />
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={CW - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--rule)" strokeWidth={1} />
            <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fontFamily="var(--font-mono)" fill="var(--ink-3)">
              ${Math.round(v)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={x(t)} y={CH - 12} textAnchor="middle" fontSize={11} fontFamily="var(--font-mono)" fill="var(--ink-3)">
            {hourly ? hFmt(t).replace(" UTC", "") : dFmt(t)}
          </text>
        ))}
        {shadePath && <path d={shadePath} fill="var(--down-bg)" opacity={0.85} />}
        {level && (
          <g>
            <line x1={PAD.l} x2={CW - PAD.r} y1={y(level.v)} y2={y(level.v)} stroke="var(--up)" strokeDasharray="6 5" strokeWidth={1.5} />
            <text x={CW - PAD.r - 4} y={y(level.v) - 6} textAnchor="end" fontSize={11.5} fontFamily="var(--font-mono)" fill="var(--up)" fontWeight={600}>
              {level.label}
            </text>
          </g>
        )}
        {marks.map((m) => (
          <g key={m.t}>
            <line x1={x(m.t)} x2={x(m.t)} y1={PAD.t} y2={CH - PAD.b} stroke="var(--ink)" strokeDasharray="3 4" strokeWidth={1.2} />
            <text
              x={x(m.t) > CW * 0.62 ? x(m.t) - 5 : x(m.t) + 5}
              textAnchor={x(m.t) > CW * 0.62 ? "end" : "start"}
              y={PAD.t + 12}
              fontSize={11.5}
              fontFamily="var(--font-mono)"
              fill="var(--ink)"
              fontWeight={600}
            >
              {m.label}
            </text>
          </g>
        ))}
        {lines.map((l) => (
          <path key={l.label} d={path(l.bars)} fill="none" stroke={l.color} strokeWidth={l.width ?? 2.5} strokeLinejoin="round" />
        ))}
        {lines.map((l) => {
          const b = lastVis(l.bars);
          if (!b) return null;
          return (
            <g key={l.label + "dot"}>
              <circle cx={x(b.t)} cy={y(b.c)} r={4.5} fill={l.color} stroke="var(--card)" strokeWidth={2} />
              <text x={Math.min(x(b.t) + 8, CW - PAD.r - 60)} y={y(b.c) - 8} fontSize={12} fontFamily="var(--font-mono)" fontWeight={600} fill={l.color}>
                {fmtPrice(b.c)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mono" style={{ fontSize: 11.5, display: "flex", gap: 14, flexWrap: "wrap", marginTop: 4 }}>
        {lines.map((l) => (
          <span key={l.label}>
            <span style={{ display: "inline-block", width: 14, height: 3, background: l.color, verticalAlign: "middle", marginRight: 5 }} />
            {l.label}
          </span>
        ))}
        {shade && (
          <span>
            <span style={{ display: "inline-block", width: 12, height: 10, background: "var(--down-bg)", verticalAlign: "middle", marginRight: 5 }} />
            discount
          </span>
        )}
        <span className="muted">Price per post-split share, USD{hourly ? ", hourly, UTC" : ", daily close"}</span>
      </figcaption>
    </figure>
  );
}

function niceStep(raw: number) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m >= 5 ? 10 : m >= 2 ? 5 : m >= 1 ? 2 : 1) * p;
}
