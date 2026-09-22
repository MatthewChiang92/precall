"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Board, BoardToken } from "@/lib/state";
import { countdown, dayLabel, fmtPct, fmtPrice, signClass } from "@/lib/format";
import { band } from "@/lib/vibe-model";
import type { VibeSummary } from "@/lib/vibe";
import { BuyButton } from "./BuyButton";
import { Gauge } from "./Gauge";
import { Spark } from "./Spark";
import { usePlayer } from "./usePlayer";

type Dir = "UP" | "DOWN";
type Crowd = { up: number; n: number };
interface MyDay {
  day: string;
  calls: Record<string, Dir>;
  scored?: { symbol: string; dir: Dir; result: string; correct: boolean; points: number }[];
  points?: number;
  correct?: number;
  decided?: number;
}
interface Me {
  name: string | null;
  days: Record<string, MyDay>;
  openCrowd: Record<string, Crowd>;
  liveCrowd: Record<string, Crowd>;
  streak: number;
  openCalledToday: number;
}

const LAUNCH_MS = Date.parse("2026-09-22T00:00:00Z");

export function Play({ initial }: { initial: Board }) {
  const pid = usePlayer();
  const [board, setBoard] = useState(initial);
  const [me, setMe] = useState<Me | null>(null);
  const [pending, setPending] = useState<Record<string, Dir>>({});
  const [toast, setToast] = useState<string | null>(null);
  const offset = useRef(0);
  const [now, setNow] = useState(initial.now);

  // Server clock offset, so the countdown matches the lock the server enforces.
  useEffect(() => {
    offset.current = initial.now - Date.now();
    const id = setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => clearInterval(id);
  }, [initial.now]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3200);
  }, []);

  const loadBoard = useCallback(async () => {
    try {
      const r = await fetch("/api/board", { cache: "no-store" });
      if (r.ok) setBoard(await r.json());
    } catch {}
  }, []);

  const loadMe = useCallback(async () => {
    if (!pid) return;
    try {
      const r = await fetch(`/api/me?pid=${pid}`, { cache: "no-store" });
      if (r.ok) setMe(await r.json());
    } catch {}
  }, [pid]);

  useEffect(() => {
    if (!pid) return;
    let live = true;
    fetch(`/api/me?pid=${pid}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && j && setMe(j))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [pid]);

  useEffect(() => {
    const id = setInterval(loadBoard, 60_000);
    return () => clearInterval(id);
  }, [loadBoard]);

  // Round rollover at 00:00 UTC: refetch everything once.
  const rolled = useRef(false);
  useEffect(() => {
    if (now >= board.lockAt && !rolled.current) {
      rolled.current = true;
      Promise.all([loadBoard(), loadMe()]).finally(() => (rolled.current = false));
    }
  }, [now, board.lockAt, loadBoard, loadMe]);

  const myOpen: Record<string, Dir> = { ...(me?.days[board.openDay]?.calls ?? {}), ...pending };
  const myLive: Record<string, Dir> = me?.days[board.liveDay]?.calls ?? {};
  const calledCount = board.tokens.filter((t) => myOpen[t.symbol]).length;

  const call = async (symbol: string, dir: Dir) => {
    if (!pid) return;
    const prev = pending[symbol];
    setPending((p) => ({ ...p, [symbol]: dir }));
    try {
      const r = await fetch("/api/call", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pid, day: board.openDay, symbol, dir }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not save");
      setMe((m) =>
        m
          ? {
              ...m,
              days: {
                ...m.days,
                [board.openDay]: {
                  ...(m.days[board.openDay] ?? { day: board.openDay, calls: {} }),
                  calls: { ...(m.days[board.openDay]?.calls ?? {}), [symbol]: dir },
                },
              },
              openCrowd: j.crowd ? { ...m.openCrowd, [symbol]: j.crowd } : m.openCrowd,
            }
          : m,
      );
      setPending((p) => {
        const n = { ...p };
        delete n[symbol];
        return n;
      });
      if (calledCount + (myOpen[symbol] ? 0 : 1) === board.tokens.length && !myOpen[symbol]) {
        flash("Slip complete. Come back after 00:00 UTC to watch it play out.");
      }
    } catch (e) {
      setPending((p) => {
        const n = { ...p };
        if (prev) n[symbol] = prev;
        else delete n[symbol];
        return n;
      });
      flash(e instanceof Error ? e.message : "Could not save");
      if (String(e).includes("locked")) loadBoard();
    }
  };

  const mood = useMemo(() => {
    const cs = Object.values(board.liveCrowd);
    const n = cs.reduce((a, c) => a + c.n, 0);
    return n ? (cs.reduce((a, c) => a + c.up, 0) / n) * 100 : null;
  }, [board.liveCrowd]);

  const lockIn = board.lockAt - now;
  const localLock = new Date(board.lockAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="hero">
        <div>
          <div className="kicker">
            Round №{board.openRound} · {dayLabel(board.openDay)} · {board.tokens.length} pre-IPO tokens
          </div>
          <h1 className="h-display">
            Call tomorrow&apos;s
            <br />
            <span className="hl">pre-IPO</span> market.
          </h1>
          <p className="hero-lede">
            Every day, call <b>UP</b> or <b>DOWN</b> on every{" "}
            <a href="https://prestocks.com" target="_blank" rel="noreferrer">
              PreStocks
            </a>{" "}
            token: OpenAI, Anthropic, SpaceX and the rest. Calls lock at <b>00:00 UTC</b> and settle 24 hours later on{" "}
            <b>on-chain Solana prices</b>. Beat the crowd for double points.
          </p>
          <Link href="/ipo" className="bell-banner">
            <b>New · The Bell:</b> SpaceX&apos;s stock rose 19% on IPO day. Its pre-IPO token fell 25%. Relive it →
          </Link>
          <div className="clockbox" suppressHydrationWarning>
            <span className="t mono" suppressHydrationWarning>
              {countdown(lockIn)}
            </span>
            <span className="l" suppressHydrationWarning>
              until calls lock
              <br />
              00:00 UTC · {localLock} your time
            </span>
          </div>
        </div>

        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <div className="kicker">PreStocks fear &amp; greed · today</div>
            <Link href="/vibe" className="kicker">
              full index →
            </Link>
          </div>
          <MarketGauge vibe={board.vibe} />
          <div className="statrow">
            <div className="stat">
              <div className="v">{me ? me.streak : "—"}</div>
              <div className="k">your streak</div>
            </div>
            <div className="stat" title="Share of all locked calls in the live round that say UP">
              <div className="v">{mood === null ? "—" : `${Math.round(mood)}%`}</div>
              <div className="k">crowd says up</div>
            </div>
            <div className="stat">
              <div className="v">{board.players}</div>
              <div className="k">players</div>
            </div>
          </div>
          <NameForm pid={pid} name={me?.name ?? null} onSaved={(n) => setMe((m) => (m ? { ...m, name: n } : m))} flash={flash} />
        </div>
      </section>

      {/* ------------------------------------------------------- open slip */}
      <section className="section" id="slip">
        <div className="section-head">
          <h2 className="h-section">Your slip · Round №{board.openRound}</h2>
          <div className="slip-progress">
            <div className="pips" aria-hidden="true">
              {board.tokens.map((t) => (
                <span key={t.symbol} className={`pip ${myOpen[t.symbol] ? "on" : ""}`} />
              ))}
            </div>
            <span>
              {calledCount}/{board.tokens.length} called · change any call until the lock
            </span>
          </div>
        </div>
        <div className="tickets">
          {board.tokens.map((t, i) => (
            <Ticket
              key={t.symbol}
              t={t}
              i={i}
              mine={myOpen[t.symbol]}
              crowd={me?.openCrowd[t.symbol] ?? null}
              vibe={board.vibe.bySymbol[t.symbol] ?? null}
              disabled={!pid || lockIn <= 0}
              onCall={(d) => call(t.symbol, d)}
            />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------ live round */}
      <LiveRound board={board} mine={myLive} crowd={me?.liveCrowd ?? board.liveCrowd} />

      {/* --------------------------------------------------------- results */}
      <Results board={board} me={me} flash={flash} />

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}

function Ticket({
  t,
  i,
  mine,
  crowd,
  vibe,
  disabled,
  onCall,
}: {
  t: BoardToken;
  i: number;
  mine?: Dir;
  crowd: Crowd | null;
  vibe: VibeSummary["bySymbol"][string] | null;
  disabled: boolean;
  onCall: (d: Dir) => void;
}) {
  const isNew = Date.parse(t.firstSeen) > LAUNCH_MS;
  const upShare = crowd && crowd.n ? crowd.up / crowd.n : null;
  return (
    <article className={`ticket ${isNew ? "new-listing" : ""}`} style={{ ["--i" as string]: i }}>
      <div className="t-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {t.image ? <img className="logo" src={t.image} alt="" width={38} height={38} /> : <span className="logo" />}
        <div>
          <div className="t-name">{t.name}</div>
          <div className="t-tick">
            {t.symbol}
            {isNew && <span className="chip" style={{ marginLeft: 6, background: "var(--hi)" }}>NEW LISTING</span>}
          </div>
        </div>
        <div className="t-price">
          <div className="p">{fmtPrice(t.live.last)}</div>
          <div className={`c ${signClass(t.change24h)}`}>{fmtPct(t.change24h)} 24h</div>
        </div>
      </div>
      <div className="t-meta" style={{ alignItems: "flex-end" }}>
        <div>
          <Spark points={t.spark} />
          <div>30d on-chain</div>
        </div>
        <div style={{ textAlign: "right" }} title="PreStocks token price vs PreStocks mark price, both from the PreStocks API">
          <div>vs PreStocks mark</div>
          <b className={signClass(t.premium)}>{t.premium === null ? "—" : fmtPct(t.premium, 1)}</b>
        </div>
      </div>
      <TicketVibe symbol={t.symbol} vibe={vibe} />
      {t.note && <div className="t-note">{t.note}</div>}
      <div className="t-links" style={{ alignItems: "center" }}>
        <BuyButton
          className="btn buy sm"
          label="Buy"
          token={{ symbol: t.symbol, name: t.name, mint: t.mint, image: t.image, url: t.url, price: t.tokenPrice, premium: t.premium }}
        />
        <Link href={`/vibe/${t.symbol.toLowerCase()}`}>Why this score</Link>
        {t.url && (
          <a href={t.url} target="_blank" rel="noreferrer">
            PreStocks ↗
          </a>
        )}
      </div>
      {mine && (
        <span className={`inked ${mine === "UP" ? "up" : "down"}`} aria-hidden="true">
          {mine}
        </span>
      )}
      <div className="calls" role="group" aria-label={`Call ${t.name}`}>
        {(["UP", "DOWN"] as const).map((d) => (
          <button
            key={d}
            type="button"
            className={`stamp ${d === "UP" ? "up-btn" : "down-btn"} ${mine === d ? "picked" : ""} ${mine && mine !== d ? "dim" : ""}`}
            aria-pressed={mine === d}
            disabled={disabled}
            onClick={() => onCall(d)}
          >
            {d === "UP" ? "▲ Up" : "▼ Down"}
          </button>
        ))}
      </div>
      <div className="crowd" aria-live="polite">
        {upShare === null ? (
          <span className="muted">{mine ? "You're the first call on this one." : "Crowd split shows after you call."}</span>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="up">{Math.round(upShare * 100)}% up</span>
              <span className="muted">{crowd!.n} calls</span>
              <span className="down">{100 - Math.round(upShare * 100)}% down</span>
            </div>
            <div className="crowd-bar">
              <span className="u" style={{ width: `${upShare * 100}%` }} />
              <span className="d" style={{ width: `${(1 - upShare) * 100}%` }} />
            </div>
          </>
        )}
      </div>
    </article>
  );
}

function MarketGauge({ vibe }: { vibe: VibeSummary }) {
  const v = vibe.market.now?.score ?? null;
  const delta = v !== null && vibe.market.yesterday !== null && vibe.market.now?.day !== undefined ? v - vibe.market.yesterday : null;
  return (
    <div className="gauge-wrap">
      <Gauge value={v} />
      <div className="gauge-num">{v === null ? "—" : Math.round(v)}</div>
      <div className="gauge-word">{v === null ? "Reading the news…" : band(v).word}</div>
      <div className="bench">
        {delta !== null && vibe.market.now?.day === vibe.day && (
          <>
            <b className={signClass(delta / 100)}>{delta >= 0 ? "▲" : "▼"} {Math.abs(Math.round(delta))}</b> since yesterday ·{" "}
          </>
        )}
        {vibe.market.now?.stories ?? 0} headlines today
        {vibe.crypto !== null && (
          <>
            {" "}· crypto <b>{Math.round(vibe.crypto)}</b>
          </>
        )}
      </div>
      <div className="muted mono" style={{ fontSize: 10.5, textAlign: "center", marginTop: 2 }}>
        40% news sentiment · 25% momentum · 20% volume · 15% premium
      </div>
      {vibe.lead && (
        <div className="t-vibe" style={{ marginTop: 10, alignSelf: "stretch", borderTop: "1px dashed var(--rule)", paddingTop: 8 }}>
          <div className="kicker" style={{ fontSize: 10 }}>Moving the market</div>
          <a className="t-story" href={vibe.lead.url} target="_blank" rel="noreferrer" title={vibe.lead.hits.join(" ")}>
            <span className={`tone ${vibe.lead.s > 0 ? "up" : "down"}`}>{vibe.lead.s > 0 ? "BULL" : "BEAR"}</span>
            {vibe.lead.title}
            {vibe.lead.publisher && <span className="muted"> · {vibe.lead.publisher}</span>}
          </a>
        </div>
      )}
    </div>
  );
}

function VibeChip({ score, href }: { score: number | null; href: string }) {
  if (score === null)
    return (
      <Link href={href} className="vibe-chip" title="No news in the last three days, so no score">
        <span className="n" style={{ background: "var(--ink-3)" }}>–</span>no coverage
      </Link>
    );
  const b = band(score);
  return (
    <Link href={href} className="vibe-chip" title="PreStocks fear & greed for this company, from news, momentum, volume and premium">
      <span className="n" style={{ background: b.color }}>{Math.round(score)}</span>
      {b.word}
    </Link>
  );
}

function TicketVibe({ symbol, vibe }: { symbol: string; vibe: VibeSummary["bySymbol"][string] | null }) {
  const href = `/vibe/${symbol.toLowerCase()}`;
  const top = vibe?.top ?? null;
  return (
    <div className="t-vibe">
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
        <VibeChip score={vibe?.now?.score ?? null} href={href} />
        <span className="muted mono" style={{ fontSize: 10.5 }}>
          {vibe?.stories3d ?? 0} headlines · 3 days
        </span>
      </div>
      {top && (
        <a className="t-story" href={top.url} target="_blank" rel="noreferrer" title={top.hits.join(" ") || "neutral"}>
          <span className={`tone ${top.s > 0.05 ? "up" : top.s < -0.05 ? "down" : "flat"}`}>
            {top.s > 0.05 ? "BULL" : top.s < -0.05 ? "BEAR" : "NEUT"}
          </span>
          {top.title}
        </a>
      )}
    </div>
  );
}

function LiveRound({ board, mine, crowd }: { board: Board; mine: Record<string, Dir>; crowd: Record<string, Crowd> }) {
  const called = Object.keys(mine).length;
  let winning = 0;
  let losing = 0;
  for (const t of board.tokens) {
    const d = mine[t.symbol];
    const s = signClass(t.live.ret);
    if (!d || s === "flat") continue;
    if ((d === "UP") === (s === "up")) winning++;
    else losing++;
  }
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="h-section">
          Live · {board.liveRound >= 1 ? `Round №${board.liveRound}` : "Warm-up"} <span className="muted" style={{ fontSize: 18 }}>{dayLabel(board.liveDay)}</span>
        </h2>
        <span className="kicker">
          locked 00:00 UTC · settles 00:00 UTC tomorrow ·{" "}
          {called ? (
            <>
              you&apos;re <span className="up">winning {winning}</span> / <span className="down">losing {losing}</span> right now
            </>
          ) : (
            "you have no calls in this round"
          )}
        </span>
      </div>
      <div className="panel tbl-wrap" style={{ padding: "4px 8px" }}>
        <table className="ledger">
          <thead>
            <tr>
              <th>Token</th>
              <th>Your call</th>
              <th>Crowd</th>
              <th className="num">Lock price</th>
              <th className="num">Now</th>
              <th className="num">Move</th>
            </tr>
          </thead>
          <tbody>
            {board.tokens.map((t) => {
              const d = mine[t.symbol];
              const s = signClass(t.live.ret);
              const status = !d || s === "flat" ? null : (d === "UP") === (s === "up") ? "win" : "lose";
              const c = crowd[t.symbol];
              return (
                <tr key={t.symbol}>
                  <td>
                    <b>{t.name}</b> <span className="muted mono" style={{ fontSize: 11 }}>{t.symbol}</span>
                  </td>
                  <td>
                    {d ? <span className={`chip ${d === "UP" ? "up" : "down"}`}>{d}</span> : <span className="muted">—</span>}{" "}
                    {status && <span className={`chip ${status}`}>{status === "win" ? "winning" : "losing"}</span>}
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {c ? <><span className="up">{Math.round((c.up / c.n) * 100)}%↑</span> <span className="muted">of {c.n}</span></> : <span className="muted">—</span>}
                  </td>
                  <td className="num">{fmtPrice(t.live.open)}</td>
                  <td className="num">{fmtPrice(t.live.last)}</td>
                  <td className={`num ${s}`}>{fmtPct(t.live.ret)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted mono" style={{ fontSize: 11, marginTop: 6 }}>
        Provisional, from the latest on-chain hourly bar. The official result is fixed at settlement.
      </p>
    </section>
  );
}

function Results({ board, me, flash }: { board: Board; me: Me | null; flash: (m: string) => void }) {
  // Most recent settled day the player has a score on.
  const myLast = useMemo(() => {
    if (!me) return null;
    const days = Object.values(me.days)
      .filter((d) => d.scored && d.scored.length)
      .sort((a, b) => (a.day < b.day ? 1 : -1));
    return days[0] ?? null;
  }, [me]);

  const share = async () => {
    if (!myLast) return;
    const order = board.tokens.map((t) => t.symbol);
    const scored = [...(myLast.scored ?? [])].sort((a, b) => order.indexOf(a.symbol) - order.indexOf(b.symbol));
    const grid = scored.map((s) => (s.result === "FLAT" || s.result === "VOID" ? "⬜" : s.correct ? "🟩" : "🟥")).join("");
    const round = board.history.find((h) => h.day === myLast.day)?.round;
    const text = `PreCall №${round ?? ""} · ${myLast.correct ?? 0}/${myLast.decided ?? 0} right · ${myLast.points ?? 0} pts\n${grid}\nCall tomorrow's pre-IPO market: ${location.origin}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        flash("Result copied. Paste it anywhere.");
      }
    } catch {}
  };

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="h-section">Results</h2>
        <span className="kicker">settled on on-chain prices · 00:00 → 00:00 UTC</span>
      </div>

      {myLast ? (
        <div className="panel" style={{ marginBottom: 14, display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div className="kicker">Your round · {dayLabel(myLast.day)}</div>
            <div className="big-num">
              {myLast.correct ?? 0}/{myLast.decided ?? 0}
            </div>
            <div className="mono" style={{ fontSize: 12 }}>{myLast.points ?? 0} points</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
            {(myLast.scored ?? []).map((s) => (
              <span
                key={s.symbol}
                className={`chip ${s.result === "FLAT" || s.result === "VOID" ? "flat" : s.correct ? "win" : "lose"}`}
                title={`You said ${s.dir}; it went ${s.result}`}
              >
                {s.symbol} {s.dir === "UP" ? "▲" : "▼"} {s.result === "FLAT" ? "push" : s.correct ? `+${s.points}` : "✗"}
              </span>
            ))}
          </div>
          <button className="btn" onClick={share} type="button">
            Share result
          </button>
        </div>
      ) : (
        <div className="empty" style={{ marginBottom: 14 }}>
          Your first result lands after your first round settles. Fill in the slip above, and the market does the rest.
        </div>
      )}

      {board.history.length ? (
        <div className="grid-days">
          {board.history.map((h) => (
            <div className="daycard" key={h.day}>
              <h4>
                {dayLabel(h.day)} {h.round >= 1 && <span className="muted">№{h.round}</span>}
              </h4>
              {board.tokens.map((t) => {
                const r = h.results[t.symbol];
                if (!r) return null;
                return (
                  <div className="r" key={t.symbol}>
                    <span>{t.symbol}</span>
                    <span className={signClass(r.ret)}>{r.result === "VOID" ? "void" : fmtPct(r.ret, 1)}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">No settled days yet.</div>
      )}
    </section>
  );
}

function NameForm({
  pid,
  name,
  onSaved,
  flash,
}: {
  pid: string | null;
  name: string | null;
  onSaved: (n: string) => void;
  flash: (m: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  if (name && !editing)
    return (
      <div className="mono" style={{ fontSize: 12, marginTop: 12 }}>
        Playing as <b>{name}</b>{" "}
        <button type="button" className="muted" style={{ background: "none", border: 0, cursor: "pointer", textDecoration: "underline" }} onClick={() => { setV(name); setEditing(true); }}>
          edit
        </button>
      </div>
    );
  return (
    <form
      style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!pid) return;
        setBusy(true);
        try {
          const r = await fetch("/api/name", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ pid, name: v.trim() }),
          });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error ?? "Could not save");
          onSaved(v.trim());
          setEditing(false);
          flash("Name saved.");
        } catch (err) {
          flash(err instanceof Error ? err.message : "Could not save");
        } finally {
          setBusy(false);
        }
      }}
    >
      <input
        className="input"
        placeholder="leaderboard name"
        value={v}
        onChange={(e) => setV(e.target.value)}
        maxLength={16}
        aria-label="Leaderboard name"
      />
      <button className="btn ghost" style={{ fontSize: 15, padding: "4px 10px 3px" }} disabled={busy || !pid} type="submit">
        Save
      </button>
      <span className="muted mono" style={{ fontSize: 10.5 }}>optional · no sign-up</span>
    </form>
  );
}
