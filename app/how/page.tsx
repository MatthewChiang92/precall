import type { Metadata } from "next";
import { WEIGHTS } from "@/lib/vibe-model";

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
        PreStocks lists a new company, it joins the next slip on its own, and its news is tracked from that day. Each token has a <b>Buy</b> button that
        opens Jupiter&apos;s own swap widget, locked to that PreStocks token, in your own wallet: a call can become a
        position if you want it to. PreCall never holds funds or keys.
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

      <h2 id="index">PreStocks fear &amp; greed</h2>
      <p>
        A daily 0-100 score for every company, and for the PreStocks market as a whole (the mean of the companies scored
        that day). It is driven by <b>news and on-chain trading, not by players</b>, so it moves every day whether or not
        anyone is playing. Bands follow CoinMarketCap&apos;s: under 25 extreme fear, 25-44 fear, 45-55 neutral, 56-75 greed,
        76 and up extreme greed. Today&apos;s value is provisional and updates as headlines and trades arrive.
      </p>
      <ul>
        <li>
          <b>News sentiment, {WEIGHTS.news}%.</b> Every Google News headline that names the company is scored bullish, neutral
          or bearish by a published finance word list (&ldquo;raises&rdquo;, &ldquo;wins contract&rdquo;, &ldquo;lawsuit&rdquo;,
          &ldquo;layoffs&rdquo;&hellip;), with negation handled (&ldquo;not approved&rdquo;). Stories about money, deals, courts
          and regulators count double; explainers and questions count half. The last three days count, weighted 1, ½ and ¼.
          Each company page lists every headline with the words that scored it, so any number can be checked.
        </li>
        <li>
          <b>Price momentum, {WEIGHTS.momentum}%.</b> The token&apos;s 7-day on-chain move divided by its own 30-day
          volatility, so a 5% week means more for a calm token than a wild one.
        </li>
        <li>
          <b>Trading volume, {WEIGHTS.volume}%.</b> Today&apos;s on-chain volume against its 30-day average. Heavy buying on an
          up day reads as greed, heavy selling on a down day as fear, and quiet trading as neutral.
        </li>
        <li>
          <b>Premium vs mark, {WEIGHTS.premium}%.</b> The token price over its PreStocks mark price, ranked across the
          companies. The PreStocks API only gives today&apos;s mark, so this factor exists from the day the index began
          recording it; earlier days use the other three factors, reweighted. Charts mark the join with a dotted line.
        </li>
      </ul>
      <p>
        A company with no headline in the last three days gets <b>no score</b>, not a fake 50. Headlines must name the
        company in the title (search matches article bodies, which would otherwise attribute other companies&apos; news),
        and sportsbook promo posts, which dominate prediction-market coverage, are filtered out. A word list is transparent
        but blunt: it can misread sarcasm or a headline where good news for one side is bad for the other.
      </p>
      <p>
        <b>Crowd mood</b> is shown separately on the play page: the share of locked calls in the live round that say UP. It
        is what players think, and it never feeds the index.
      </p>

      <h2>SpaceX</h2>
      <p>
        SpaceX listed on Nasdaq (SPCX) on 12 June 2026 after a 5-for-1 split. PreStocks applied the split on-chain with the
        token&apos;s Token-2022 display multiplier, so price feeds quote one raw token as five post-split shares. Calls are
        scored on percentage moves, so the basis cancels out.
      </p>

      <h2>Rewind</h2>
      <p>
        Rewind is an instant practice mode on real past daily closes. It has no effect on the leaderboard. A &ldquo;day&rdquo;
        there is the next daily bar, which can skip calendar days with no trades.
      </p>

      <h2>Seed to IPO</h2>
      <p>
        Seed to IPO flies each company through its real funding rounds, then its token&apos;s real daily candles. Every round
        is listed with its source; rounds without a reported valuation are left out. It doesn&apos;t affect the leaderboard.
      </p>

      <h2>Privacy</h2>
      <p>
        No account, no wallet, no email. Your browser holds a random id; that id is your only credential and is never shown
        to anyone. Clearing site data starts you fresh. This is a free game, not financial advice, and no money is in play.
      </p>
    </div>
  );
}
