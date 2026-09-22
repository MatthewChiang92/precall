import Link from "next/link";

/** PreCall's own chrome. The Fear & Greed newspaper (/vibe) has its own. */
export default function GameLayout({ children }: LayoutProps<"/">) {
  return (
    <>
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
    </>
  );
}
