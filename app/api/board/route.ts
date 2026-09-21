import { after } from "next/server";
import { refreshAll } from "@/lib/rounds";
import { getBoard } from "@/lib/state";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  after(() => refreshAll().catch((e) => console.error("refresh", e)));
  return Response.json(await getBoard(), { headers: { "cache-control": "no-store" } });
}
