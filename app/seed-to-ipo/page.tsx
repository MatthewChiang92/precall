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
        // SpaceX has listed: its course is the frozen pre-listing history (weekly, per
        // post-split share), ending on listing day.
        bars: listed ? IPO.preListing : s.bars,
        rounds: FUNDING[s.symbol]?.rounds ?? [],
        listing: listed ? { day: IPO.listingDay, venue: "NASDAQ: SPCX" } : null,
      };
    })
    // A month of weekly candles, so a token that just listed (Figure) joins once it has one.
    .filter((s) => s.bars.length >= 4);
  return (
    <>
      <div className="kicker">Arcade · real funding rounds · real on-chain candles</div>
      <h1 className="h-display">Seed to IPO</h1>
      <p className="hero-lede">
        Fly a pre-IPO company through its life. <b>Indigo pipes are its real funding rounds</b>, then{" "}
        <b>every pipe is a real weekly candle</b> of its PreStocks token. SpaceX ends at the Nasdaq bell; the others
        haven&apos;t got there yet.
      </p>
      <FlyChart series={series} />
    </>
  );
}
