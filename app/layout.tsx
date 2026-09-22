import type { Metadata, Viewport } from "next";
import { Big_Shoulders, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const display = Big_Shoulders({ variable: "--font-display", subsets: ["latin"], weight: ["600", "800", "900"] });
const sans = IBM_Plex_Sans({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://precall-six.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "PreCall: the daily pre-IPO call",
  description:
    "Call UP or DOWN on every PreStocks pre-IPO token (OpenAI, Anthropic, SpaceX and more). Calls lock at 00:00 UTC and settle on on-chain Solana prices. Free, no wallet needed.",
  openGraph: {
    title: "PreCall: the daily pre-IPO call",
    description: "Call tomorrow's move on OpenAI, Anthropic, SpaceX and every PreStocks token. Settled on-chain.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#f1ebdd", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <header className="mast">
          <div className="mast-inner">
            <Link href="/" className="brand" aria-label="PreCall home">
              <span className="brand-word">PreCall</span>
              <span className="brand-sub">the daily pre-IPO call · on Solana</span>
            </Link>
            <nav className="nav">
              <Link href="/">Play</Link>
              <Link href="/vibe">Fear &amp; Greed</Link>
              <Link href="/rewind">Rewind</Link>
              <Link href="/fly">Seed to IPO</Link>
              <Link href="/ipo">The Bell</Link>
              <Link href="/leaderboard">Leaders</Link>
              <Link href="/how">How it works</Link>
            </nav>
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
