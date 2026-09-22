import type { Metadata } from "next";
import { FlyChart } from "@/components/FlyChart";
import { FUNDING } from "@/lib/funding";
import { IPO } from "@/lib/ipo";
import { getRewindSeries } from "@/lib/state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Seed to IPO · PreCall" };

export default async function FlyPage() {
  const series = (await getRewindSeries())
    .map((s) => {
      const listed = s.mint === IPO.mint;
      return {
        ...s,
        // SpaceX has listed: its course is the frozen pre-listing history (per post-split
        // share, as on The Bell), ending on listing day.
        bars: listed ? IPO.preListing : s.bars,
        rounds: FUNDING[s.symbol]?.rounds ?? [],
        listing: listed ? { day: IPO.listingDay, venue: "NASDAQ: SPCX" } : null,
      };
    })
    .filter((s) => s.bars.length >= 10);
  return (
    <>
      <div className="kicker">Arcade · real funding rounds · real on-chain candles</div>
      <h1 className="h-display">Seed to IPO</h1>
      <p className="hero-lede">
        Fly a pre-IPO company through its life. <b>Gold pipes are its real funding rounds</b>, then{" "}
        <b>every pipe is a real daily candle</b> of its PreStocks token. SpaceX ends at the Nasdaq bell; the other seven
        haven&apos;t got there yet.
      </p>
      <FlyChart series={series} />
    </>
  );
}
