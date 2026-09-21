import "server-only";
import { claim, markFetch, sql } from "./db";

const REGISTRY_URL = "https://prestocks.com/api/prestocks";
const REFRESH_SEC = 300;

export interface Token {
  symbol: string;
  name: string;
  mint: string;
  image: string | null;
  url: string | null;
  description: string | null;
  markPrice: number | null;
  tokenPrice: number | null;
  geckoPool: string | null;
  firstSeen: string;
  lastSeen: string;
}

interface RegistryRow {
  name?: unknown;
  symbol?: unknown;
  description?: unknown;
  image?: unknown;
  external_url?: unknown;
  contract_address?: unknown;
  markPrice?: unknown;
  tokenPrice?: unknown;
  supply?: unknown;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : null);

/** "Anthropic PreStocks" -> "Anthropic" */
function cleanName(name: string) {
  return name.replace(/\s+PreStocks$/i, "").trim();
}

/**
 * Mirror the PreStocks registry into `tokens`. The list is read at runtime, so a
 * newly listed company joins the game on its own. Throttled to once per 5 min.
 */
export async function refreshRegistry(force = false): Promise<void> {
  if (!(await claim("registry", force ? 0 : REFRESH_SEC))) return;
  try {
    const res = await fetch(REGISTRY_URL, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`registry HTTP ${res.status}`);
    const rows = (await res.json()) as RegistryRow[];
    if (!Array.isArray(rows)) throw new Error("registry not an array");
    let n = 0;
    for (const r of rows) {
      const symbol = str(r.symbol);
      const mint = str(r.contract_address);
      const name = str(r.name);
      if (!symbol || !mint || !name) continue;
      await sql`
        insert into tokens (symbol, name, mint, image, url, description, mark_price, token_price, supply)
        values (${symbol}, ${cleanName(name)}, ${mint}, ${str(r.image)}, ${str(r.external_url)},
                ${str(r.description)}, ${num(r.markPrice)}, ${num(r.tokenPrice)}, ${num(r.supply)})
        on conflict (symbol) do update set
          name = excluded.name, mint = excluded.mint, image = excluded.image, url = excluded.url,
          description = excluded.description, mark_price = excluded.mark_price,
          token_price = excluded.token_price, supply = excluded.supply, last_seen = now()`;
      n++;
    }
    await markFetch("registry", true, `${n} tokens`);
  } catch (e) {
    await markFetch("registry", false, String(e));
    // Serve the last mirrored list; the registry being down must not take the game down.
  }
}

/** Tokens currently listed (seen in the registry within the last day). */
export async function listTokens(): Promise<Token[]> {
  const rows = await sql`
    select symbol, name, mint, image, url, description, mark_price, token_price, gecko_pool,
           first_seen, last_seen
    from tokens
    where last_seen > now() - interval '1 day'
    order by symbol`;
  return rows.map((r) => ({
    symbol: r.symbol,
    name: r.name,
    mint: r.mint,
    image: r.image,
    url: r.url,
    description: r.description,
    markPrice: r.mark_price,
    tokenPrice: r.token_price,
    geckoPool: r.gecko_pool,
    firstSeen: new Date(r.first_seen).toISOString(),
    lastSeen: new Date(r.last_seen).toISOString(),
  }));
}
