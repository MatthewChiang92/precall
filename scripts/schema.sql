-- PreCall schema. Idempotent: safe to run on every deploy.

-- The PreStocks registry, mirrored. Never hardcoded: rows appear when the API lists them.
create table if not exists tokens (
  symbol       text primary key,
  name         text not null,
  mint         text not null unique,
  image        text,
  url          text,
  description  text,
  mark_price   double precision,
  token_price  double precision,
  supply       double precision,
  gecko_pool   text,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now()
);

-- On-chain OHLCV. `t` is the bar START. Bars exist only for periods that traded.
create table if not exists candles (
  mint    text not null,
  res     text not null check (res in ('1h', '1d')),
  source  text not null check (source in ('gmgn', 'gecko')),
  t       timestamptz not null,
  o double precision not null,
  h double precision not null,
  l double precision not null,
  c double precision not null,
  v double precision,
  primary key (mint, res, source, t)
);

-- Throttle + single-flight for upstream refreshes and settlement.
create table if not exists fetch_log (
  key        text primary key,
  fetched_at timestamptz not null,
  ok         boolean,
  note       text
);

-- One row per (UTC day, token). Written once, never updated: a settled round is final.
create table if not exists round_results (
  day         date not null,
  symbol      text not null,
  mint        text not null,
  open_price  double precision,
  close_price double precision,
  ret         double precision,
  result      text not null check (result in ('UP', 'DOWN', 'FLAT', 'VOID')),
  source      text,
  settled_at  timestamptz not null default now(),
  primary key (day, symbol)
);

create table if not exists players (
  id         uuid primary key,
  name       text,
  created_at timestamptz not null default now()
);
create unique index if not exists players_name_lower on players (lower(name));

create table if not exists calls (
  player_id  uuid not null references players(id),
  day        date not null,
  symbol     text not null,
  dir        text not null check (dir in ('UP', 'DOWN')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (player_id, day, symbol)
);
create index if not exists calls_day_symbol on calls (day, symbol);
