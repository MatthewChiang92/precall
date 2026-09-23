"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Play" },
  { href: "/fear-greed", label: "Fear & Greed" },
  { href: "/rewind", label: "Rewind" },
  { href: "/seed-to-ipo", label: "Seed to IPO" },
  { href: "/ipo", label: "IPO Guide" },
  { href: "/leaderboard", label: "Leaders" },
  { href: "/how", label: "How it works" },
];

/** Header nav; the current section gets the PreStocks active pill. */
export function Nav() {
  const path = usePathname();
  return (
    <nav className="nav">
      {LINKS.map((l) => {
        const on = l.href === "/" ? path === "/" : path === l.href || path.startsWith(`${l.href}/`);
        return (
          <Link key={l.href} href={l.href} aria-current={on ? "page" : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** PreCall mark: a PreStocks-indigo tile with an up-trend line. */
export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="pc-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6264d9" stopOpacity="0.9" />
          <stop offset="1" stopColor="#6264d9" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#pc-mark)" />
      <path d="M8 21.5l5.5-5.5 4 4L24 13.5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.5 13.5H24V18" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
