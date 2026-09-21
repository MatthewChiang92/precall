import "server-only";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

export const sql = neon(url);

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
