// Freezes the on-chain price history around SpaceX's Nasdaq listing (2026-06-12)
// into lib/data/spacex-ipo.json, so the IPO Replay never depends on a rate-limited
// API at runtime. History is immutable, so a snapshot is exact, not a cache.
//
// Usage: node --env-file=.env.local scripts/snapshot-spacex-ipo.mjs
//
// Sources, per series (all prices USD, bars keyed by UTC start time in ms):
//  - token daily, 21 May – 14 Jun: GeckoTerminal, SPACEX/USDC pool 22Pth…fZg, the
//    deepest SpaceX pool trading before the listing (GMGN only serves the last 100 days).
//  - token daily, 15 Jun on: GMGN token-level (all pools).
//  - token hourly, 11–13 Jun: same GeckoTerminal pool, the highest-volume pool on listing day.
//  - SPCXx (xStocks tokenized SPCX) hourly 12–14 Jun and daily 12–14 Jun: GeckoTerminal
//    SPCXx/USDC pool AHNN6…pRHpq (its deepest pool); daily 15 Jun on: GMGN token-level.
import { writeFileSync, mkdirSync } from "node:fs";

const TOKEN = "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh";
const SPCXX = "Xs3oZwbHvqis4NYcf4YKWmEia2eC84wSiVrcYcTqpH8";
const TOKEN_POOL = "22PthLk8TYnurtbWKRyECFd99cHHbfsbPNHfeMetzfZg";
const SPCXX_POOL = "AHNN6JmvaGG6XUoSg7sEr38gRYDB2jTbUvqXVuqaRHpq";
const KEY = process.env.GMGN_API_KEY;
if (!KEY) throw new Error("GMGN_API_KEY not set");

const utc = (s) => Date.parse(`${s}T00:00:00Z`);
const GMGN_FROM = utc("2026-06-15");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gecko(pool, tf, mint, beforeSec) {
  const qs = `limit=1000&currency=usd&token=${mint}` + (beforeSec ? `&before_timestamp=${beforeSec}` : "");
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/pools/${pool}/ohlcv/${tf}?${qs}`);
    if (r.status === 429) {
      await sleep(15_000);
      continue;
    }
    if (!r.ok) throw new Error(`gecko ${r.status} ${await r.text()}`);
    const j = await r.json();
    await sleep(3_000);
    return j.data.attributes.ohlcv_list
      .map(([t, o, h, l, c, v]) => ({ t: t * 1000, o, h, l, c, v }))
      .sort((a, b) => a.t - b.t);
  }
  throw new Error("gecko 429 x4");
}

async function gmgnDaily(mint) {
  const qs = new URLSearchParams({
    chain: "sol",
    address: mint,
    resolution: "1d",
    timestamp: String(Math.floor(Date.now() / 1000)),
    client_id: crypto.randomUUID(),
  });
  const r = await fetch(`https://openapi.gmgn.ai/v1/market/token_kline?${qs}`, { headers: { "X-APIKEY": KEY } });
  const j = await r.json();
  if (j.code !== 0) throw new Error(`gmgn ${JSON.stringify(j).slice(0, 200)}`);
  await sleep(1_500);
  return j.data.list
    .map((b) => ({ t: Number(b.time), o: +b.open, h: +b.high, l: +b.low, c: +b.close, v: +b.volume }))
    .sort((a, b) => a.t - b.t);
}

const round = (b) => ({
  t: b.t,
  o: +b.o.toPrecision(6),
  h: +b.h.toPrecision(6),
  l: +b.l.toPrecision(6),
  c: +b.c.toPrecision(6),
  v: Math.round(b.v),
});
const inRange = (from, to) => (b) => b.t >= from && b.t < to;
// Today's bar is still forming; keep only finished days.
const today = utc(new Date().toISOString().slice(0, 10));

const tokGeckoDay = await gecko(TOKEN_POOL, "day", TOKEN);
const tokGeckoHour = await gecko(TOKEN_POOL, "hour", TOKEN, utc("2026-06-14") / 1000);
const spxGeckoDay = await gecko(SPCXX_POOL, "day", SPCXX);
const spxGeckoHour = await gecko(SPCXX_POOL, "hour", SPCXX, utc("2026-06-15") / 1000);
const tokGmgn = await gmgnDaily(TOKEN);
const spxGmgn = await gmgnDaily(SPCXX);

const out = {
  generatedAt: new Date().toISOString(),
  listingDay: "2026-06-12",
  mints: { token: TOKEN, spcxx: SPCXX },
  pools: { token: TOKEN_POOL, spcxx: SPCXX_POOL },
  token: {
    daily: [
      ...tokGeckoDay.filter(inRange(0, GMGN_FROM)),
      ...tokGmgn.filter(inRange(GMGN_FROM, today)),
    ].map(round),
    hourly: tokGeckoHour.filter(inRange(utc("2026-06-11"), utc("2026-06-14"))).map(round),
  },
  spcxx: {
    daily: [
      ...spxGeckoDay.filter(inRange(0, GMGN_FROM)),
      ...spxGmgn.filter(inRange(GMGN_FROM, today)),
    ].map(round),
    hourly: spxGeckoHour.filter(inRange(utc("2026-06-12"), utc("2026-06-14"))).map(round),
  },
};
for (const k of ["token", "spcxx"])
  for (const r of ["daily", "hourly"]) {
    const L = out[k][r];
    console.log(k, r, L.length, new Date(L[0].t).toISOString(), "->", new Date(L.at(-1).t).toISOString());
  }
mkdirSync(new URL("../lib/data/", import.meta.url), { recursive: true });
writeFileSync(new URL("../lib/data/spacex-ipo.json", import.meta.url), JSON.stringify(out));
