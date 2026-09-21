import { GameError, crowdFor, placeCall } from "@/lib/game";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { pid?: unknown; day?: unknown; symbol?: unknown; dir?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  try {
    const { pid, day, symbol, dir } = body;
    if (typeof symbol !== "string") throw new GameError("bad token");
    await placeCall(String(pid), String(day), symbol, dir as "UP" | "DOWN");
    const crowd = await crowdFor([String(day)]);
    return Response.json({ ok: true, crowd: crowd[String(day)]?.[symbol] ?? null });
  } catch (e) {
    if (e instanceof GameError) return Response.json({ error: e.message }, { status: e.status });
    console.error(e);
    return Response.json({ error: "server error" }, { status: 500 });
  }
}
