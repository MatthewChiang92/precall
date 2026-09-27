import { after } from "next/server";
import { refreshAll } from "@/lib/rounds";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Pages are cached, so a cached render cannot fetch upstream; each page load
// pings this instead. refreshAll throttles every step in the database; this
// skips even those checks on a warm instance.
let last = 0;

export async function POST() {
  if (Date.now() - last > 60_000) {
    last = Date.now();
    after(() => refreshAll().catch((e) => console.error("refresh", e)));
  }
  return new Response(null, { status: 204 });
}
