import "server-only";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// node-postgres through Supabase's transaction pooler (port 6543): it never pipelines
// queries on one connection, which the pooler cannot handle. TLS always, except for a
// local database; Supabase's CA is not in Node's store, so the chain is not verified.
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const pool = new pg.Pool({
  connectionString: url,
  max: 5,
  idleTimeoutMillis: 10_000,
  ssl: local ? false : { rejectUnauthorized: false },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

async function query(text: string, params: unknown[] = []): Promise<Row[]> {
  return (await pool.query(text, params)).rows;
}

/** Tagged template: every `${value}` is a bind parameter, never spliced into the SQL. */
export function sql(strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]> {
  return query(strings.reduce((text, s, i) => `${text}$${i}${s}`), values);
}
sql.query = query;

/**
 * Single-flight + throttle. Returns true for exactly one caller per `key`
 * per `maxAgeSec` window, so concurrent page views cannot stampede an
 * upstream API. The claim is one atomic upsert.
 */
export async function claim(key: string, maxAgeSec: number): Promise<boolean> {
  const rows = await sql`
    insert into fetch_log (key, fetched_at) values (${key}, now())
    on conflict (key) do update set fetched_at = now()
      where fetch_log.fetched_at < now() - make_interval(secs => ${maxAgeSec})
    returning key`;
  return rows.length > 0;
}

export async function markFetch(key: string, ok: boolean, note: string | null = null) {
  await sql`update fetch_log set ok = ${ok}, note = ${note} where key = ${key}`;
}

/** Let a failed claim be retried sooner than its full throttle window. */
export async function releaseClaim(key: string, retryAfterSec: number, maxAgeSec: number) {
  await sql`
    update fetch_log
    set fetched_at = now() - make_interval(secs => ${Math.max(0, maxAgeSec - retryAfterSec)})
    where key = ${key}`;
}

/** Mark `key` as freshly fetched (used when one job fetches data another job throttles on). */
export async function touch(key: string) {
  await sql`
    insert into fetch_log (key, fetched_at, ok) values (${key}, now(), true)
    on conflict (key) do update set fetched_at = now(), ok = true`;
}
