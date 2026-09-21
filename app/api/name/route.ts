import { GameError, setName } from "@/lib/game";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { pid, name } = (await req.json()) as { pid?: unknown; name?: unknown };
    await setName(String(pid), String(name ?? "").trim());
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof GameError) return Response.json({ error: e.message }, { status: e.status });
    console.error(e);
    return Response.json({ error: "server error" }, { status: 500 });
  }
}
