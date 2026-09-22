import { HIGH } from "./lexicon";

// How each company is found in the news. Google News matches a query against the
// article BODY, so every story must also name the company in its HEADLINE (one of
// `aliases`) or it is dropped: without that filter a large share of stories belong
// to some other company. A token PreStocks lists later gets a default built from
// its name, so it is covered the day it appears.

export interface NewsProfile {
  /** Google News query (OR-joined phrases). */
  query: string;
  /** Headline must match one of these (whole word, case-insensitive). */
  aliases: string[];
}

const NO_PROMO = '-"promo code" -bonus -NFL -odds';

const PROFILES: Record<string, NewsProfile> = {
  ANDURIL: { query: '"Anduril"', aliases: ["Anduril"] },
  ANTHROPIC: { query: '"Anthropic"', aliases: ["Anthropic"] },
  // Never a bare "Figure": it is an English word. Its founder's name is kept because
  // his coverage is almost entirely about Figure's robots.
  FIGUREAI: {
    query: '"Figure AI" OR "Figure.ai" OR "Figure Robotics" OR "Brett Adcock"',
    aliases: ["Figure AI", "Figure.ai", "Figure Robotics", "Brett Adcock", "Adcock"],
  },
  // Excluding affiliate spam in the query itself: otherwise it fills Google's 100-result cap.
  KALSHI: { query: `"Kalshi" ${NO_PROMO}`, aliases: ["Kalshi"] },
  NEURALINK: { query: '"Neuralink"', aliases: ["Neuralink"] },
  OPENAI: { query: '"OpenAI" OR "ChatGPT"', aliases: ["OpenAI", "ChatGPT"] },
  POLYMARKET: { query: `"Polymarket" ${NO_PROMO}`, aliases: ["Polymarket"] },
  // SpaceX absorbed xAI; "SpaceXAI" headlines are the same company.
  SPACEX: { query: '"SpaceX" OR "Starship" OR "SpaceXAI"', aliases: ["SpaceX", "SpaceXAI", "SPCX", "Starship"] },
};

export function profileFor(symbol: string, name: string): NewsProfile {
  return PROFILES[symbol] ?? { query: `"${name}"`, aliases: [name] };
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function headlineMatches(title: string, p: NewsProfile): boolean {
  return p.aliases.some((a) => new RegExp(`(^|[^A-Za-z0-9])${esc(a)}(?![A-Za-z0-9])`, "i").test(title));
}

// Prediction-market coverage is dominated by sportsbook affiliate posts ("promo code",
// "$50 bonus") and odds pages. They say nothing about the company, so they are dropped,
// along with price-ticker pages and video uploads.
const SPAM = [
  /promo\s*code/i,
  /\b(bonus|referral|invite|signup|sign-up)\s+code/i,
  /\b[Cc]ode\s+["“”']?[A-Z0-9]{4,}\b/,
  /\$\d+\s+(trading\s+)?bonus/i,
  /\bget\s+\$\d+/i,
  /\btrade\s+\$\d+,?\s+get/i,
  /\bbest\s+(bets|picks|prediction market)/i,
  /\bpicks?,?\s+predictions?\b/i,
  /\bodds\b.*\b(vs\.?|favored|spread)\b/i,
  /\b(vs\.?|at)\b.*\bodds\b/i,
  /\bsites?\s+ranked\b/i,
  /\bapps?\s*(&amp;|&|and)\s*sites\b/i,
  /\bpayment methods\b/i,
  /\bprice\s*\([A-Z]+\/USD\)/i,
  /\blive price\b/i,
  /\bprice prediction\b/i,
];
// Sports markets listed on a prediction exchange are about the game, not the company.
// Kept only when the headline is also about business (a deal, a court, a regulator).
const SPORTS = /\b(NFL|NBA|MLB|NHL|NCAA|WNBA|UFC|college football|week \d+|super bowl|playoffs?|quarterback|QB|coach|touchdown|MVP|starting market|market insights|market for every|market makes)\b/i;
const SPAM_PUBLISHERS = new Set(["YouTube", "Kalshi News", "DeFi Rate"]);

export function isSpam(title: string, publisher: string | null): boolean {
  if (publisher && SPAM_PUBLISHERS.has(publisher)) return true;
  if (SPORTS.test(title) && !HIGH.test(title)) return true;
  return SPAM.some((re) => re.test(title));
}
