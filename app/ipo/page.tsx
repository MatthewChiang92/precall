import type { Metadata } from "next";
import { IpoGuide } from "@/components/IpoGuide";

export const metadata: Metadata = {
  title: "IPO Guide · PreCall",
  description:
    "What happens to a PreStocks pre-IPO token when its company goes public: the lockup, the discount, conversion and the deadline. Make the calls a holder has to make.",
};

export default function IpoPage() {
  return (
    <>
      <div className="kicker">IPO guide · 8 steps · straight from PreStocks&apos; FAQ</div>
      <h1 className="h-display">Going public</h1>
      <p className="hero-lede">
        What happens to your pre-IPO token when the company lists? Walk through it step by step and make the calls a holder
        has to make: <b>the lockup, the discount, converting, and the deadline</b>.
      </p>
      <IpoGuide />
    </>
  );
}
