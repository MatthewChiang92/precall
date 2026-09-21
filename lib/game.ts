import "server-only";
import { sql } from "./db";
import { LAUNCH_DAY, addDays, clock, isDay } from "./time";

export type Dir = "UP" | "DOWN";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isPid = (s: unknown): s is string => typeof s === "string" && UUID.test(s);
export const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;

export class GameError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export async function ensurePlayer(pid: string) {
  await sql`insert into players (id) values (${pid}::uuid) on conflict (id) do nothing`;
}

/**
 * Record (or change) a call. Only the open round accepts calls, and the lock is
 * enforced here, on the server clock, not in the browser.
 */
export async function placeCall(pid: string, day: string, symbol: string, dir: Dir, now = Date.now()) {
  if (!isPid(pid)) throw new GameError("bad player id");
  if (!isDay(day)) throw new GameError("bad day");
  if (dir !== "UP" && dir !== "DOWN") throw new GameError("bad direction");
  const c = clock(now);
  if (day > c.openDay) throw new GameError("That round is not open yet.", 409);
  if (day !== c.openDay) throw new GameError("That round is locked. Calls are open for the next one.", 409);
  if (now >= c.lockAt) throw new GameError("Round locked", 409);
  const tok = await sql`
    select 1 from tokens where symbol = ${symbol} and last_seen > now() - interval '1 day'`;
  if (!tok.length) throw new GameError("unknown token");
  await ensurePlayer(pid);
  await sql`
    insert into calls (player_id, day, symbol, dir) values (${pid}::uuid, ${day}::date, ${symbol}, ${dir})
    on conflict (player_id, day, symbol) do update set dir = excluded.dir, updated_at = now()`;
}

export async function setName(pid: string, name: string) {
  if (!isPid(pid)) throw new GameError("bad player id");
  if (!NAME_RE.test(name)) throw new GameError("Names are 3-16 letters, digits or _");
  await ensurePlayer(pid);
  try {
    await sql`update players set name = ${name} where id = ${pid}::uuid`;
  } catch (e) {
    if (String(e).includes("players_name_lower")) throw new GameError("That name is taken", 409);
    throw e;
  }
}

export interface Crowd {
  up: number;
  n: number;
}

/** Crowd split per (day, symbol). */
export async function crowdFor(days: string[]): Promise<Record<string, Record<string, Crowd>>> {
  if (!days.length) return {};
  const rows = await sql`
    select day::text as day, symbol, count(*) filter (where dir = 'UP')::int as up, count(*)::int as n
    from calls where day = any(${days}::date[]) group by 1, 2`;
  const out: Record<string, Record<string, Crowd>> = {};
  for (const r of rows) (out[r.day] ??= {})[r.symbol] = { up: r.up, n: r.n };
  return out;
}

/**
 * Scoring, one place, in SQL:
 *   correct call            1 point
 *   correct AND contrarian  2 points  (your side had < 50% of that token's calls)
 *   wrong                   0
 *   FLAT / VOID             push, not counted either way
 */
const SCORED_SQL = `
  with crowd as (
    select day, symbol, count(*) filter (where dir = 'UP') as up, count(*) as n
    from calls group by 1, 2
  )
  select c.player_id, c.day::text as day, c.symbol, c.dir, r.result, r.ret,
         (r.result in ('UP', 'DOWN')) as decided,
         (c.dir = r.result) as correct,
         case when c.dir = r.result
              then 1 + ((case when c.dir = 'UP' then cr.up else cr.n - cr.up end)::float / cr.n < 0.5)::int
              else 0 end as points
  from calls c
  join round_results r on r.day = c.day and r.symbol = c.symbol
  join crowd cr on cr.day = c.day and cr.symbol = c.symbol
  where c.day >= $1::date`;

export interface MyDay {
  day: string;
  calls: Record<string, Dir>;
  scored?: { symbol: string; dir: Dir; result: string; correct: boolean; points: number }[];
  points?: number;
  correct?: number;
  decided?: number;
}

export async function myState(pid: string, now = Date.now()) {
  if (!isPid(pid)) throw new GameError("bad player id");
  const c = clock(now);
  const from = addDays(c.liveDay, -30);
  const [player, calls, scoredRows, crowd] = await Promise.all([
    sql`select name from players where id = ${pid}::uuid`,
    sql`select day::text as day, symbol, dir from calls
        where player_id = ${pid}::uuid and day >= ${from}::date order by day`,
    sql.query(`select * from (${SCORED_SQL}) s where s.player_id = $2::uuid order by s.day, s.symbol`, [from, pid]),
    crowdFor([c.openDay, c.liveDay]),
  ]);

  const days: Record<string, MyDay> = {};
  for (const r of calls) (days[r.day] ??= { day: r.day, calls: {} }).calls[r.symbol] = r.dir;
  for (const r of scoredRows) {
    const d = (days[r.day] ??= { day: r.day, calls: {} });
    d.scored ??= [];
    d.scored.push({ symbol: r.symbol, dir: r.dir, result: r.result, correct: r.correct, points: r.points });
    d.points = (d.points ?? 0) + r.points;
    d.decided = (d.decided ?? 0) + (r.decided ? 1 : 0);
    d.correct = (d.correct ?? 0) + (r.decided && r.correct ? 1 : 0);
  }

  // Crowd for the OPEN round is revealed only for tokens you have already called,
  // so nobody can just copy the herd.
  const mineOpen = days[c.openDay]?.calls ?? {};
  const openCrowd: Record<string, Crowd> = {};
  for (const [sym, v] of Object.entries(crowd[c.openDay] ?? {})) if (mineOpen[sym]) openCrowd[sym] = v;

  // Streak: consecutive rounds played, counting back from the newest round you have called.
  const played = (d: string) => Boolean(days[d] && Object.keys(days[d].calls).length);
  let streak = 0;
  for (let d = played(c.openDay) ? c.openDay : c.liveDay; played(d); d = addDays(d, -1)) streak++;

  return {
    name: (player[0]?.name as string | null) ?? null,
    days,
    openCrowd,
    liveCrowd: crowd[c.liveDay] ?? {},
    streak,
    openCalledToday: Object.keys(mineOpen).length,
  };
}

export async function leaderboard(limit = 100) {
  const rows = await sql.query(
    `select substr(md5('precall:' || s.player_id::text), 1, 10) as tag, p.name,
            sum(s.points)::int as points,
            count(*) filter (where s.decided and s.correct)::int as correct,
            count(*) filter (where s.decided)::int as decided,
            count(distinct s.day)::int as rounds
     from (${SCORED_SQL}) s
     join players p on p.id = s.player_id
     group by s.player_id, p.name
     having count(*) filter (where s.decided) > 0
     order by points desc, correct desc, decided asc
     limit $2`,
    [LAUNCH_DAY, limit],
  );
  return rows.map((r) => ({
    // A one-way tag, never the player id: the id is the player's only credential.
    tag: String(r.tag),
    name: (r.name as string | null) ?? `anon-${String(r.tag).slice(0, 4)}`,
    points: r.points as number,
    correct: r.correct as number,
    decided: r.decided as number,
    rounds: r.rounds as number,
  }));
}

export async function playerCount(): Promise<number> {
  const r = await sql`select count(distinct player_id)::int as n from calls`;
  return r[0]?.n ?? 0;
}
