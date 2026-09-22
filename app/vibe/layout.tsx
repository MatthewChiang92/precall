import type { Viewport } from "next";
import { Libre_Franklin, Newsreader, UnifrakturMaguntia } from "next/font/google";
import Link from "next/link";
import { PAPER_NAME } from "@/components/paper/Paper";
import "./paper.css";

// Nameplate in blackletter, news set in a serif drawn for news, labels and tables in Franklin Gothic's heir.
const blackletter = UnifrakturMaguntia({ variable: "--np-blackletter", subsets: ["latin"], weight: "400" });
const serif = Newsreader({ variable: "--np-serif", subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"] });
const sans = Libre_Franklin({ variable: "--np-sans", subsets: ["latin"] });

export const viewport: Viewport = { themeColor: "#f2efe7" };

export default function PaperLayout({ children }: LayoutProps<"/vibe">) {
  return (
    <div className={`np ${blackletter.variable} ${serif.variable} ${sans.variable}`}>
      <div className="np-wrap">
        {children}
        <footer className="np-foot">
          <p>
            <b>{PAPER_NAME}</b> is published by <Link href="/">PreCall</Link>. Every PreStocks company is scored 0 to 100 each UTC day
            from the headlines that name it and its token&apos;s on-chain trading. Headlines are linked to their publishers. No
            player input. <Link href="/how#index">How the index is built</Link>. Not financial advice.
          </p>
        </footer>
      </div>
    </div>
  );
}
