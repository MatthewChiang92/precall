import type { Metadata } from "next";
import { Rewind } from "@/components/Rewind";
import { pick } from "@/lib/rewind";
import { getRewindSeries } from "@/lib/state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rewind · PreCall" };

export default async function RewindPage() {
  const series = (await getRewindSeries()).filter((s) => s.bars.length >= 25);
  return (
    <>
      <div className="kicker">Practice on real history · no waiting</div>
      <h1 className="h-display">Rewind</h1>
      <p className="hero-lede">
        A real stretch of on-chain daily closes, dates hidden. Call the next day. How long a streak can you run?
      </p>
      <Rewind series={series} first={pick(series)} />
    </>
  );
}
