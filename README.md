# PreCall

**A daily fear & greed index for every PreStocks pre-IPO company, driven by the news, plus games that teach how pre-IPO companies boom, bust and go public. Buy any token in-app through Jupiter.**

Live: https://precall-six.vercel.app · Built for the [Stocklana hackathon](https://hackathons.solana.com/hackathons/stocklana), PreStocks track.

## What's in it

| Mode | What you do | Data |
| --- | --- | --- |
| **Fear & Greed** (`/fear-greed`) | A 0-100 score per company per day, and for the PreStocks market, with 1d / 7d / 30d windows, a heat ranking and a crypto benchmark. Each company page shows the factor breakdown, score over price, and every headline with the words that scored it. | Google News RSS (headline-filtered, spam-filtered, 45-day backfill), on-chain candles, PreStocks mark vs token price |
| **Play** (`/`) | Every week, call each PreStocks token UP or DOWN. Calls lock Monday 00:00 UTC and settle a week later on real on-chain closes. Streaks, a leaderboard, a double-points bonus for calling against the crowd, and a share grid. | PreStocks registry (read at runtime, so new listings join automatically), GMGN token-level candles, GeckoTerminal fallback |
| **Seed to IPO** (`/seed-to-ipo`) | Flappy-style arcade. Gold pipes are the company's **real funding rounds**, rising with its valuation. Then every pipe is a **real weekly candle** of its PreStocks token. SpaceX's course ends at the Nasdaq bell. | Sourced funding history (`lib/data/funding.json`, a source URL for every round), on-chain candles |
| **Rewind** (`/rewind`) | Instant practice: call the next week on a real stretch of history, dates hidden. | On-chain weekly closes |
| **IPO Guide** (`/ipo`) | Eight steps through what happens to a pre-IPO token when its company goes public or is bought: the lockup, the discount, converting, the 9-month deadline. Multiple choice, with a judgement call that has no right answer. | PreStocks' FAQ (`prestocks.com/faq`), no company-specific numbers |

Playing needs no wallet and no sign-up. Every token has a **Buy** button that opens the [Jupiter Plugin](https://developers.jup.ag/docs/tool-kits/plugin) swap in a dialog, with the output mint **fixed to that PreStocks token**. Jupiter handles the wallet; PreCall never touches keys or funds.

## How the index works

| Factor | Weight | Source |
| --- | --- | --- |
| News sentiment | 40% | Every headline naming the company, scored by a published finance lexicon (`lib/news/lexicon.ts`) with negation; money, deal and court stories count double, explainers half. Last 3 days, weighted 1 / ½ / ¼. |
| Price momentum | 25% | 7-day on-chain log return over the token's own 30-day volatility, through the normal CDF |
| Trading volume | 20% | Today's volume vs its 30-day average, signed by the day's move (heavy buying = greed, heavy selling = fear) |
| Premium vs mark | 15% | Token price over PreStocks mark, ranked across companies. Snapshotted daily from launch; earlier days reweight the other three, and charts mark the join. |

- **No news, no score.** A company with no headline in 3 days is shown as "no coverage", never a fake 50.
- **Headline filter.** Google News matches article bodies, so a story must name the company in its title.
- **Spam filter.** Sportsbook affiliate spam ("promo code", "$50 bonus"), which dominates prediction-market coverage, is excluded in the query and again by pattern.
- **Tone isn't stored.** It's computed from the title on every run, so a lexicon fix re-scores all history.
- **Players never feed the index.** Crowd mood is shown separately.

## How settlement works

- **Rounds:** a round is one UTC week, Monday 00:00 to the next Monday 00:00. Daily moves on thinly traded tokens were mostly noise: over the stored history, 29–44% of days moved under 0.5% for Anduril, Kalshi, Neuralink and Polymarket.
- **Result:** the move from the last on-chain trade before the opening Monday 00:00 to the last before the closing one, read from daily bars (GMGN serves only its last ~100 bars, and 100 hourly bars don't reach back a week).
- **Pending:** a week the data can't prove stays pending. The system never writes VOID on its own.
- **Final:** settled results are never rewritten.

GMGN aggregates every pool. GeckoTerminal is only a fallback, picking the pool with the most 24-hour volume, because dead pools with high reserves produced fake flat days.

## Stack

- **App:** Next.js 16 (App Router) on Vercel
- **Database:** Neon Postgres
- **Jobs:** a Vercel cron settles rounds, refreshes prices and news, and recomputes the index. Page views keep everything warm between runs (throttled, single-flight). `/api/cron?news=<seconds>` gives the news backfill a bigger slice.
- **Swap:** Jupiter Plugin, loaded on first click

## Run it

```bash
npm install
cp .env.example .env.local        # DATABASE_URL, GMGN_API_KEY, CRON_SECRET
node --env-file=.env.local scripts/migrate.mjs
npm run dev
```

To regenerate the SpaceX IPO snapshot: `node --env-file=.env.local scripts/snapshot-spacex-ipo.mjs`.

Not financial advice. A free game; no money is in play.
