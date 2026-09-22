// Headline sentiment from a finance word list. Deterministic and explainable: every
// score carries the exact words that moved it, and the site shows them. Pure and
// client-safe.
//
// A headline's tone is the sum of its cue weights, squashed to -1..1. A negator in
// the three words before a cue ("not", "no", "denies") flips it. Materiality weights
// the story in the day's average: money, deals, courts and regulators count double;
// explainers, listicles and questions count half.

type Cue = [RegExp, number];

/** Split on top-level `|` only, so a cue can carry its own `(?:a|b)` group. */
function alternatives(words: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of words) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "|" && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

// A cue ending in a literal "$" ("wins $") cannot take a closing `\b`; every other cue
// must, or "invests?" would match inside "investigating".
const cue = (words: string, w: number): Cue[] =>
  alternatives(words).map((p) => [new RegExp(`\\b${p}${p.endsWith("\\$") ? "" : "\\b"}`, "i"), w]);

const CUES: Cue[] = [
  // ------------------------------------------- phrases that beat their own words
  ...cue("raises? .{0,25}(?:concerns|questions|fears|doubts|alarms?|eyebrows)|take over .{0,30}accounts|helps? .{0,30}(?:hack|attack|take over)", -2),
  ...cue("seeks? .{0,24}raise|raise at \\$|in talks to raise|new funding|funding talks", 2),
  // ---------------------------------------------------------------- strong up
  ...cue(
    "raises|raised|raising|funding round|valuation (?:soars|jumps|doubles|triples|hits|tops)|soars?|soaring|surges?|surging|skyrockets?|record(?:-breaking)? (?:high|revenue|quarter|year|valuation|launch)|breakthrough|beats? (?:estimates|expectations)|wins? (?:\\$|contract|approval|case|lawsuit)|won (?:\\$|contract|approval|case)|awarded|awards|lands? (?:\\$|contract|deal)|secures?|approval|approved|clears? (?:hurdle|review)|doubles|triples|profitable|profitability|all-time high|blockbuster|oversubscribed",
    2,
  ),
  // ------------------------------------------------------------------ mild up
  ...cue(
    "launch(?:es|ed)?|unveils?|unveiled|debuts?|expands?|expansion|grows?|growth|gains?|rises?|rising|climbs?|jumps?|rall(?:y|ies)|boosts?|upgrades?|partners? with|partnership|collaborat(?:ion|es|e)|agreement|teams up|signs?|deal|contract|invests?|investment|backs|backed|milestone|success(?:ful)?|leads|leading|tops|dominates?|strong(?:er)?|beats|outperforms?|best|first|hires?|hiring|adds|adding jobs|new jobs|momentum|demand|bullish|optimism|praise[sd]?|helps?|gives|restores?|speaks again|new voice",
    1,
  ),
  // -------------------------------------------------------------- strong down
  ...cue(
    "lawsuits?|sue|sues|sued|suing|probe[ds]?|investigat(?:es|ed|ion|ing)|antitrust|fraud(?:sters)?|scandal|crash(?:es|ed)?|explodes?|exploded|explosion|layoffs?|lays? off|job cuts|bankrupt(?:cy)?|collapses?|collapsed|plunges?|plummets?|tanks?|sell-?off|banned|bans?|crackdown|ordered to stop|orders? .{0,40}to stop|halts?|halted|suspend(?:s|ed)?|recalls?|breach(?:es)?|hack(?:s|ed|ers)?|leaked?|leaks|outage|rogue|misaligned|accused|accuses|charged|indicted|fined|penalty|subpoena|downgraded?|overvalued|bubble|burns? cash|cash burn|losses|loses \\$|resigns?|ousted|fired|quits?|exodus|stolen|thieves|theft|violations?",
    -2,
  ),
  // ---------------------------------------------------------------- mild down
  ...cue(
    "delays?|delayed|pauses?|paused|falls?|falling|fell|drops?|dropped|slips?|slides?|slumps?|sinks?|tumbles?|declines?|declined|dips?|cuts?|slows?|slowdown|struggles?|struggling|hurts?|hurting|hits .{0,20}business|warns?|warning|risks?|risky|concerns?|worries|worried|fears?|doubts?|skeptic(?:al|ism)|criticism|criticized|critics|backlash|protest(?:s|ors|ers)?|rejects?|rejected|denied|blocks?|blocked|fails?|failed|failure|problem|trouble|troubles|controversy|controversial|dispute|challenges?|scrutiny|pressure|threat|threatens?|vulnerab(?:le|ility|ilities)|on hold|taken off|bearish|loss|losing|departs?|departure|exits?|stops?|stop operating|illegal|collusion|oversold|dark web|calls out|flaws?|bugs?|worrying|glitch(?:es)?",
    -1,
  ),
];

const NEGATORS = /\b(not|no|never|without|denies|denied|won't|isn't|aren't|wasn't|didn't|doesn't|fails to|failed to)\s+(\S+\s+){0,2}$/i;

export const HIGH = /(\$\d|\bbillion\b|\bmillion\b|\bvaluation\b|\bipo\b|\bfunding\b|\braise[sd]?\b|\brevenue\b|\bcontract\b|\bdeal\b|\blawsuit|\bsues?\b|\bsued\b|\bprobe\b|\bregulator|\bsec\b|\bcftc\b|\bcourt\b|\bjudge\b|\battorney general\b|\b(ag|doj|ftc)\b|\bacquir|\bacquisition\b|\bmerger\b|\blayoffs?\b|\bearnings\b|\bs-1\b|\bnasdaq\b|\bnasa\b|\bpentagon\b|\bair force\b|\barmy\b|\bnavy\b|\bfda\b)/i;
const LOW = /(\?\s*$|^(how|why|what|when|should|is|are|can|will|could)\b|\bexplained\b|\bopinion\b|\breview\b|\btips\b|\bguide\b|\beverything you need\b|\bvs\.?\s|\bquote of the day\b|\blisten\b|\bpodcast\b|\bwatch\b)/i;

export interface Tone {
  /** -1 (bearish) .. +1 (bullish); 0 is neutral. */
  s: number;
  /** Materiality weight in the day's average: 0.5, 1 or 2. */
  w: number;
  /** The cues that fired, signed, e.g. ["+raises", "−lawsuit"]. */
  hits: string[];
}

export function tone(title: string): Tone {
  const t = title.replace(/&amp;/g, "&").replace(/\s+/g, " ");
  let sum = 0;
  const hits: string[] = [];
  const taken: [number, number][] = [];
  for (const [re, w] of CUES) {
    const m = re.exec(t);
    if (!m) continue;
    const a = m.index;
    const b = a + m[0].length;
    // A longer, stronger cue already covers this span ("lays off" before "off").
    if (taken.some(([x, y]) => a < y && b > x)) continue;
    taken.push([a, b]);
    const neg = NEGATORS.test(t.slice(Math.max(0, a - 40), a));
    const v = neg ? -w : w;
    sum += v;
    const word = m[0].toLowerCase();
    hits.push(`${v > 0 ? "+" : "−"}${word.length > 22 ? word.split(" ")[0] + "…" + word.split(" ").at(-1) : word}`);
  }
  const s = sum === 0 ? 0 : sum / (Math.abs(sum) + 1.5);
  const w = LOW.test(t) ? 0.5 : HIGH.test(t) ? 2 : 1;
  return { s: Math.round(s * 1000) / 1000, w, hits };
}
