import { refreshRegistry } from "@/lib/prestocks";
import { refreshAll } from "@/lib/rounds";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Vercel Cron calls this daily just after the UTC close. Page views also keep data
// warm (throttled), so a late or missed cron run cannot strand a round.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  await refreshRegistry(true);
  const out = await refreshAll();
  return Response.json({ ok: true, ...out });
}
