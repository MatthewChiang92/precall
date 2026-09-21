import type { Metadata } from "next";

export const metadata: Metadata = { title: "How it works · PreCall" };

export default function How() {
  return (
    <div className="prose">
      <div className="kicker">Rules and method</div>
      <h1 className="h-display">How it works</h1>

      <h2>The game</h2>
      <p>
        Every UTC day is a round. Before it starts, you call <b>UP</b> or <b>DOWN</b> on each PreStocks token. The round
        <b> locks at 00:00 UTC</b>: the opening price is taken, and no call can be added or changed after that (the server
        enforces this, not your browser). It <b>settles at the next 00:00 UTC</b> against the closing price.
      </p>
      <ul>
        <li>Correct call: <b>1 point</b>.</li>
        <li>
          Correct <i>and</i> contrarian (your side had under half of that token&apos;s calls): <b>2 points</b>.
        </li>
        <li>Wrong: 0. A move under 0.01% is a <b>push</b> and counts neither way.</li>
        <li>Your streak is the number of consecutive rounds you have played.</li>
      </ul>
      <p>
        You see the crowd&apos;s split on a token only after you have called it yourself, so nobody can just copy the herd.
      </p>

      <h2>The tokens</h2>
      <p>
        The list is read live from the public <code>prestocks.com/api/prestocks</code> registry. Nothing is hardcoded: when
        PreStocks lists a new company, it joins the next slip on its own. Each token links to its PreStocks page and to a
        Jupiter swap, so a call can become a position if you want it to.
      </p>

      <h2>The prices</h2>
      <p>
        Results use <b>on-chain Solana trades</b>, not a quoted mark. The price at an instant is the close of the last hourly
        bar that finished at or before it; an hour with no trades carries the last trade forward. The primary feed is GMGN,
        which aggregates every pool for a token; GeckoTerminal (the most-traded pool) is the fallback. The open and the close
        of a round always come from <b>one fetch of one feed</b>, and each result records which feed it used.
      </p>
      <p>
        A settled result is written once and never edited. If prices for a day cannot be proven (for example, a feed is down),
        the day stays <i>pending</i> rather than being guessed, and calls on it score nothing until it settles.
      </p>
      <p>
        The &ldquo;vs PreStocks mark&rdquo; figure on each ticket compares the token price with the PreStocks mark price, both
        from the PreStocks API, so both sides share one basis.
      </p>

      <h2 id="mood">Crowd mood</h2>
      <p>
        The gauge is the share of all locked calls in the live round that say UP, from 0 (everyone bearish) to 100 (everyone
        bullish). Bands follow the familiar fear-and-greed layout: under 25 max bearish, 25-44 bearish, 45-55 split, 56-75
        bullish, over 75 max bullish. It is what players think, not a model&apos;s guess.
      </p>

      <h2>SpaceX</h2>
      <p>
        SpaceX listed on Nasdaq (SPCX) on 12 June 2026 after a 5-for-1 split. The on-chain PreStocks token still quotes the
        pre-split basis, roughly five times the SPCX share price. Calls are scored on percentage moves, so the basis cancels
        out.
      </p>

      <h2>Rewind</h2>
      <p>
        Rewind is an instant practice mode on real past daily closes. It has no effect on the leaderboard. A &ldquo;day&rdquo;
        there is the next daily bar, which can skip calendar days with no trades.
      </p>

      <h2>Privacy</h2>
      <p>
        No account, no wallet, no email. Your browser holds a random id; that id is your only credential and is never shown
        to anyone. Clearing site data starts you fresh. This is a free game, not financial advice, and no money is in play.
      </p>
    </div>
  );
}
