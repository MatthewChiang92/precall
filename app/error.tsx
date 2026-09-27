"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <div className="kicker">Temporarily unavailable</div>
      <h1 className="h-display">Data is taking a break</h1>
      <p className="hero-lede">
        We couldn&apos;t load live data just now. Try again in a minute, or read the <Link href="/ipo">IPO Guide</Link>{" "}
        while you wait.
      </p>
      <button className="btn" onClick={() => retry()}>
        Try again
      </button>
    </>
  );
}
