import type { Metadata } from "next";
import { IpoReplay } from "@/components/IpoReplay";

export const metadata: Metadata = {
  title: "The Bell: SpaceX IPO Replay · PreCall",
  description: "SpaceX was the first PreStocks company to go public. Relive what the bell did to the pre-IPO token, hour by hour, on real on-chain data.",
};

export default function IpoPage() {
  return (
    <>
      <div className="kicker">IPO replay · real on-chain data</div>
      <h1 className="h-display">The bell</h1>
      <p className="hero-lede">
        On 12 June 2026 SpaceX became the first PreStocks company to go public. <b>The stock rose on its first day. The
        pre-IPO token fell.</b> Relive it with $1,000 and make the calls yourself.
      </p>
      <IpoReplay />
    </>
  );
}
