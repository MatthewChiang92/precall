import { refreshRegistry } from "@/lib/prestocks";
import { PRIMARY, fetchBars } from "@/lib/prices";
import { refreshAll } from "@/lib/rounds";
import { refreshVibe } from "@/lib/vibe";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Vercel Cron calls this daily just after the UTC close. Page views also keep data
// warm (throttled), so a late or missed cron run cannot strand a round.
// ?diag=1 probes each price feed from THIS runtime and reports, without writing.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (new URL(req.url).searchParams.get("diag")) {
    const mint = "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF";
    const probe = async (s: "gmgn" | "gecko") => {
      const t = Date.now();
      try {
        const bars = await fetchBars(mint, "1h", s);
        return { ok: true, bars: bars.length, last: bars.at(-1)?.t ?? null, ms: Date.now() - t };
      } catch (e) {
        return { ok: false, error: String(e).slice(0, 300), ms: Date.now() - t };
      }
    };
    return Response.json({ primary: PRIMARY, hasKey: Boolean(process.env.GMGN_API_KEY), gmgn: await probe("gmgn") });
  }
  await refreshRegistry(true);
  // ?news=<seconds> gives the news backfill a bigger slice of this run.
  const newsSec = Number(new URL(req.url).searchParams.get("news") ?? 120);
  const out = await refreshAll(Date.now(), Math.min(Math.max(newsSec, 10), 240) * 1000);
  await refreshVibe(Date.now(), true);
  return Response.json({ ok: true, primary: PRIMARY, ...out });
}
