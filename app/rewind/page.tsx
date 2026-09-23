import type { Metadata } from "next";
import { Rewind } from "@/components/Rewind";
import { WINDOW, pick } from "@/lib/rewind";
import { getRewindSeries } from "@/lib/state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rewind · PreCall" };

export default async function RewindPage() {
  // At least a few puzzles per token: WINDOW weeks shown, then the week to call.
  const series = (await getRewindSeries()).filter((s) => s.bars.length >= WINDOW + 4);
  return (
    <>
      <div className="kicker">Practice on real history · no waiting</div>
      <h1 className="h-display">Rewind</h1>
      <p className="hero-lede">
        A real stretch of on-chain weekly closes, dates hidden. Call the next week. How long a streak can you run?
      </p>
      <Rewind series={series} first={pick(series)} />
    </>
  );
}
