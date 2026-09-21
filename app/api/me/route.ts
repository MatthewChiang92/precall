import { GameError, myState } from "@/lib/game";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const pid = new URL(req.url).searchParams.get("pid") ?? "";
  try {
    return Response.json(await myState(pid), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof GameError) return Response.json({ error: e.message }, { status: e.status });
    console.error(e);
    return Response.json({ error: "server error" }, { status: 500 });
  }
}
