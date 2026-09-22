// Private funding history per PreStocks company, researched and sourced (lib/data/funding.json).
// Only rounds with a reported valuation are kept: those are what the Seed-to-IPO course climbs.
import raw from "./data/funding.json";

export type Round = {
  date: string;
  label: string;
  raisedUsd: number | null;
  valuationUsd: number;
  source: string;
  note?: string;
};
export type Company = { name: string; founded: number | string; blurb: string; rounds: Round[] };

export const FUNDING = raw as unknown as Record<string, Company>;
