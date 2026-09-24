import type { Metadata, Viewport } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import Link from "next/link";
import { BrandMark, Nav } from "@/components/Nav";
import "./globals.css";

// PreStocks type: Inter for everything, Roboto Mono for figures.
const sans = Inter({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const mono = Roboto_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://precallipo.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "PreCall: the weekly pre-IPO call",
  description:
    "Call UP or DOWN on every PreStocks pre-IPO token (OpenAI, Anthropic, SpaceX and more). Calls lock every Monday 00:00 UTC and settle a week later on on-chain Solana prices. Free, no wallet needed.",
  openGraph: {
    title: "PreCall: the weekly pre-IPO call",
    description: "Call next week's move on OpenAI, Anthropic, SpaceX and every PreStocks token. Settled on-chain.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <header className="mast">
          <div className="mast-inner">
            <Link href="/" className="brand" aria-label="PreCall home">
              <BrandMark />
              <span className="brand-word">PreCall</span>
              <span className="brand-sub">the weekly pre-IPO call · on Solana</span>
            </Link>
            <Nav />
          </div>
        </header>
        <main className="page">{children}</main>
        <footer className="foot">
          <p>
            A free game about{" "}
            <a href="https://prestocks.com" target="_blank" rel="noreferrer">
              PreStocks
            </a>{" "}
            pre-IPO tokens on Solana. Token list read live from the PreStocks API; prices from on-chain
            trades; headlines from Google News. Playing needs no wallet and no money. Buying opens Jupiter&apos;s own swap in your own
            wallet. Not financial advice.
          </p>
        </footer>
      </body>
    </html>
  );
}
