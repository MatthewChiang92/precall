import type { Metadata } from "next";
import { FlyChart } from "@/components/FlyChart";
import { getRewindSeries } from "@/lib/state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Fly the Chart · PreCall" };

export default async function FlyPage() {
  const series = (await getRewindSeries()).filter((s) => s.bars.length >= 10);
  return (
    <>
      <div className="kicker">Arcade · real on-chain candles</div>
      <h1 className="h-display">Fly the chart</h1>
      <p className="hero-lede">
        Pick a pre-IPO company and fly through its real price history. <b>Every pipe is a daily candle.</b> Survive the
        rallies and the dumps.
      </p>
      <FlyChart series={series} />
    </>
  );
}
