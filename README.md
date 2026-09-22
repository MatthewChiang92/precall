# PreCall

**Games that teach how pre-IPO companies boom, bust and go public, on real PreStocks data.**

Live: https://precall-six.vercel.app · Built for the [Stocklana hackathon](https://hackathons.solana.com/hackathons/stocklana), PreStocks track.

## What's in it

| Mode | What you do | Data |
| --- | --- | --- |
| **Play** (`/`) | Every day, call each PreStocks token UP or DOWN. Calls lock at 00:00 UTC and settle on real on-chain closes. Streaks, a leaderboard, a double-points bonus for calling against the crowd, and a share grid. | PreStocks registry (read at runtime, so new listings join automatically), GMGN token-level candles, GeckoTerminal fallback |
| **Seed to IPO** (`/fly`) | Flappy-style arcade. Gold pipes are the company's **real funding rounds**, rising with its valuation. Then every pipe is a **real daily candle** of its PreStocks token. SpaceX's course ends at the Nasdaq bell. | Sourced funding history (`lib/data/funding.json`, a source URL for every round), on-chain candles |
| **The Bell** (`/ipo`) | An interactive replay of SpaceX's IPO, the first PreStocks company to go public. Hold $1,000 of the token through the listing, make two calls, and see what the lockup did to it. | Frozen on-chain snapshot (`lib/data/spacex-ipo.json`) plus cited facts |
| **Rewind** (`/rewind`) | Instant practice: call the next day on a real stretch of history, dates hidden. | On-chain daily closes |

No wallet and no sign-up. Every token links to its Jupiter swap and its PreStocks page.

## What The Bell found

- PreStocks applied SpaceX's 5-for-1 split **on-chain**. The mint's Token-2022 `scaledUiAmount` multiplier moved from 1 to 5, effective 2026-06-10 04:30 UTC, so wallets show five times the tokens. DEX feeds still quote the raw token, so one raw token equals five post-split shares. The replay divides by 5 to put the token and the public stock on the same basis.
- On the eve of the listing the token priced SpaceX at about $141 a share, above the $135 IPO price. On listing day SPCX closed at $161.11. The token fell about 25% and ended the day about 36% below SPCXx.
- The discount comes from the post-IPO lockup on the SPV's shares, which PreStocks disclosed on 7 June. It has since held at roughly 15–38%. Holders must swap into SPCXx before 11:59pm UTC on 12 March 2027.

## How settlement works

- **Rounds:** a round is one UTC day.
- **Result:** the move from the last on-chain trade at or before 00:00 to the last at or before 24:00.
- **Pending:** a day the data can't prove stays pending. The system never writes VOID on its own.
- **Final:** settled results are never rewritten.

GMGN aggregates every pool. GeckoTerminal is only a fallback, picking the pool with the most 24-hour volume, because dead pools with high reserves produced fake flat days.

## Stack

- **App:** Next.js 16 (App Router) on Vercel
- **Database:** Neon Postgres
- **Jobs:** a Vercel cron settles rounds and refreshes prices

## Run it

```bash
npm install
cp .env.example .env.local        # DATABASE_URL, GMGN_API_KEY, CRON_SECRET
node --env-file=.env.local scripts/migrate.mjs
npm run dev
```

To regenerate the SpaceX IPO snapshot: `node --env-file=.env.local scripts/snapshot-spacex-ipo.mjs`.

Not financial advice. A free game; no money is in play.
