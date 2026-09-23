"use client";

import Link from "next/link";
import { useState } from "react";

// What happens to a PreStocks token when its company goes public, as a run of calls.
// Every answer paraphrases PreStocks' own FAQ; nothing here is tied to one company.

const FAQ = "https://prestocks.com/faq";

type Option = { k: string; label: string; feedback: string };
interface Step {
  tab: string;
  stage: string;
  situation: string;
  q: string;
  options: Option[];
  /** The right option. Absent on a judgement call, which has no right answer and isn't scored. */
  right?: string;
}

const STEPS: Step[] = [
  {
    tab: "Price",
    stage: "Before the IPO",
    situation: "You hold a PreStocks token in a private company. No IPO has been announced.",
    q: "What does the token's price represent?",
    right: "share",
    options: [
      {
        k: "share",
        label: "The price of one share of the company",
        feedback:
          "Right. PreStocks says the price is the gross price per share of the company. Each token is backed by holding entities that are directly or indirectly invested in it, and arbitrage between the token and those holdings helps keep the two prices aligned.",
      },
      {
        k: "valuation",
        label: "The company's total valuation",
        feedback: "No. It tracks the price of one share, not the whole company.",
      },
      {
        k: "sentiment",
        label: "Nothing in particular: it's a crypto token that trades on sentiment",
        feedback:
          "No. It trades on-chain, but PreStocks says every token is backed by holding entities invested in the company, and arbitrage helps keep its price in line with the real-world share price.",
      },
    ],
  },
  {
    tab: "Rights",
    stage: "Before the IPO",
    situation: "The company holds its annual shareholder vote.",
    q: "Do you get a say?",
    right: "no",
    options: [
      {
        k: "yes",
        label: "Yes: holding the token makes me a shareholder",
        feedback:
          "No. The token gives you the price exposure only: no ownership, voting, dividend, information or other legal rights. It isn't issued or endorsed by the company either.",
      },
      {
        k: "no",
        label: "No: I get the price exposure, not shareholder rights",
        feedback:
          "Right. PreStocks gives indirect economic exposure to the company and no ownership, voting, dividend, information or other legal rights. The companies don't issue or endorse the tokens.",
      },
      {
        k: "later",
        label: "Not yet, but I will once it goes public",
        feedback:
          "No. Going public doesn't turn the token into shares. What changes at the IPO is that the token becomes convertible, as the next steps show.",
      },
    ],
  },
  {
    tab: "No IPO",
    stage: "Still private",
    situation: "Years go by and the company stays private. You want your money back.",
    q: "Can you get out?",
    right: "sell",
    options: [
      {
        k: "stuck",
        label: "No, I'm locked in until it lists",
        feedback: "No. You can sell on-chain at any time, even if the company never goes public.",
      },
      {
        k: "sell",
        label: "Yes, I can sell on-chain any time",
        feedback:
          "Right. You can exit through on-chain liquidity even if the company never goes public. The price you get, and how fast, depend on how much liquidity there is at the time.",
      },
      {
        k: "expire",
        label: "It expires if there's no IPO after a few years",
        feedback:
          "No. PreStocks' FAQ sets no expiry for a company that stays private. Its conversion deadlines apply after an IPO or a merger.",
      },
    ],
  },
  {
    tab: "Listing",
    stage: "IPO day",
    situation: "The company lists on a stock exchange, and its shares start trading publicly.",
    q: "What happens to your token?",
    right: "convertible",
    options: [
      {
        k: "auto",
        label: "It turns into the public stock automatically",
        feedback: "No. Nothing happens automatically. The token stays in your wallet, and converting it is up to you.",
      },
      {
        k: "convertible",
        label: "It becomes convertible into a tokenized version of the public stock",
        feedback:
          "Right. The position becomes convertible, fully on-chain and without KYC, into an equivalent tokenized public stock. Converting is up to you, and a variable fee may be charged on conversions.",
      },
      {
        k: "cash",
        label: "It's cashed out at the IPO price",
        feedback:
          "No. There's no payout at an IPO. A payout in USDC is what happens when the company is bought for cash, which comes up at the end.",
      },
    ],
  },
  {
    tab: "Lockup",
    stage: "After the listing",
    situation: "The stock is trading. Your token trades below it.",
    q: "Why?",
    right: "lockup",
    options: [
      {
        k: "lockup",
        label: "The shares behind the token are still locked up",
        feedback:
          "Right. The shares behind the token can have a post-IPO lockup, typically 6 months. While they're locked, liquidity may be limited and the token may trade at a discount to the public stock.",
      },
      {
        k: "fee",
        label: "PreStocks charges a fee for holding the token",
        feedback:
          "No. There's no annual management fee. Trading and conversion fees may apply, but the gap PreStocks describes after an IPO comes from the lockup.",
      },
      {
        k: "broken",
        label: "Something has gone wrong with the token",
        feedback:
          "Not necessarily. PreStocks says the token may trade at a discount during the lockup, because liquidity is limited while the shares are locked.",
      },
    ],
  },
  {
    tab: "Your move",
    stage: "During the lockup",
    situation: "Two months into the lockup, the token still trades at a discount to the stock.",
    q: "What do you do?",
    options: [
      {
        k: "sell",
        label: "Sell now",
        feedback:
          "You're out, at today's discounted price. That's a fair choice if you need the money or don't want to wait out the lockup, but you give up whatever the discount was.",
      },
      {
        k: "hold",
        label: "Hold, and convert once the lockup ends",
        feedback:
          "You wait for the shares to unlock, then convert into the tokenized public stock. PreStocks ties the discount to the lockup but doesn't promise when, or whether, it closes, and the stock itself can fall while you wait.",
      },
      {
        k: "buy",
        label: "Buy more while it's at a discount",
        feedback:
          "You're betting the gap narrows as the shares unlock, on top of betting on the stock. Liquidity may be limited during the lockup, so getting in and out can cost more than usual.",
      },
    ],
  },
  {
    tab: "Deadline",
    stage: "Ten months after the IPO",
    situation: "You find the token in an old wallet. You never converted it.",
    q: "What's it worth?",
    right: "expired",
    options: [
      {
        k: "auto",
        label: "It converted on its own, so I hold the tokenized stock",
        feedback: "No. Conversion doesn't happen on its own, and the window has now closed.",
      },
      {
        k: "expired",
        label: "Nothing: it has expired",
        feedback:
          "Right. Holders have up to 9 months after the IPO (3 months after a 6-month lockup) to convert. After that the token expires worthless and is no longer supported.",
      },
      {
        k: "same",
        label: "The same as before: it still trades",
        feedback: "No. After the 9-month deadline the token expires worthless and is no longer supported.",
      },
    ],
  },
  {
    tab: "Acquired",
    stage: "A different ending",
    situation: "Instead of listing, the company is bought by another company for cash.",
    q: "What happens to your token?",
    right: "usdc",
    options: [
      {
        k: "zero",
        label: "It becomes worthless",
        feedback:
          "No. In a cash deal the net proceeds are shared out pro rata in USDC, and you can convert your tokens into it. There's still a deadline: 6 months after conversion opens.",
      },
      {
        k: "usdc",
        label: "It becomes convertible into USDC from the sale",
        feedback:
          "Right. In a cash deal the net proceeds are distributed pro rata as USDC, which holders can convert their tokens into. You have up to 6 months after conversion opens; then the tokens expire worthless. If the buyer pays in its own shares instead, the token may become convertible into a tokenized version of those shares, if PreStocks creates and supports one.",
      },
      {
        k: "stock",
        label: "It turns into the buyer's stock",
        feedback:
          "No, and this deal is in cash. Even when a buyer pays in shares, the token only may become convertible into a tokenized version of them, if PreStocks creates and supports one.",
      },
    ],
  },
];

const SCORED = STEPS.filter((s) => s.right).length;

export function IpoGuide() {
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState<Record<number, string>>({});

  const go = (n: number) => {
    setStep(n);
    document.getElementById("guide")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const restart = () => {
    setPicks({});
    go(0);
  };

  const done = step === STEPS.length;
  const score = STEPS.filter((s, i) => s.right && picks[i] === s.right).length;

  return (
    <div id="guide" style={{ display: "flex", flexDirection: "column", gap: 18, scrollMarginTop: 80 }}>
      <div className="ipo-progress" aria-label={done ? "Summary" : `Step ${step + 1} of ${STEPS.length}`}>
        {[...STEPS.map((s) => s.tab), "Summary"].map((n, i) => (
          <span key={n} className={i === step ? "on" : i < step ? "done" : ""}>
            {n}
          </span>
        ))}
      </div>

      {done ? (
        <Summary score={score} onRestart={restart} />
      ) : (
        <StepCard
          key={step}
          n={step}
          s={STEPS[step]}
          pick={picks[step] ?? null}
          onPick={(k) => setPicks((p) => (p[step] ? p : { ...p, [step]: k }))}
          onBack={step ? () => go(step - 1) : undefined}
          onNext={() => go(step + 1)}
        />
      )}
    </div>
  );
}

function StepCard({
  n,
  s,
  pick,
  onPick,
  onBack,
  onNext,
}: {
  n: number;
  s: Step;
  pick: string | null;
  onPick: (k: string) => void;
  onBack?: () => void;
  onNext: () => void;
}) {
  const chosen = s.options.find((o) => o.k === pick) ?? null;
  const state = (k: string) => {
    if (!pick) return "";
    if (!s.right) return k === pick ? "picked" : "dim";
    if (k === s.right) return "right";
    return k === pick ? "wrong" : "dim";
  };
  return (
    <section className="panel ipo-chapter">
      <div className="kicker">
        Step {n + 1} of {STEPS.length} · {s.stage}
      </div>
      <p style={{ fontSize: 17, margin: "6px 0 12px" }}>{s.situation}</p>
      <div className="ipo-decision">
        <div className="t-name" style={{ fontSize: 22 }}>
          {s.q}
        </div>
        {!s.right && <div className="muted mono" style={{ fontSize: 11.5, marginTop: 2 }}>Your call: there&apos;s no right answer to this one.</div>}
        <div className="ipo-options" role="group" aria-label={s.q}>
          {s.options.map((o) => (
            <button
              key={o.k}
              type="button"
              className={`ipo-option ${state(o.k)}`}
              disabled={Boolean(pick)}
              aria-pressed={pick === o.k}
              onClick={() => onPick(o.k)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {chosen && (
        <div className="ipo-result" aria-live="polite">
          {s.right && (
            <span className={`chip ${pick === s.right ? "win" : "lose"}`} style={{ marginRight: 8 }}>
              {pick === s.right ? "Right" : "Not quite"}
            </span>
          )}
          {chosen.feedback}{" "}
          <a className="src" href={FAQ} target="_blank" rel="noreferrer">
            PreStocks FAQ ↗
          </a>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        {onBack && (
          <button className="btn ghost" type="button" onClick={onBack}>
            ← Back
          </button>
        )}
        <button className="btn" type="button" onClick={onNext} disabled={!pick}>
          {!pick ? "Pick an answer to continue" : n === STEPS.length - 1 ? "See the summary →" : "Next →"}
        </button>
      </div>
    </section>
  );
}

function Summary({ score, onRestart }: { score: number; onRestart: () => void }) {
  return (
    <section className="panel ipo-chapter">
      <div className="kicker">Summary</div>
      <h2 className="h-section" style={{ margin: "2px 0 4px" }}>
        {score} of {SCORED} right
      </h2>
      <p className="muted" style={{ marginTop: 0 }}>What to expect when a PreStocks company goes public:</p>
      <ul className="ipo-list">
        <li>
          The token tracks <b>the price of one share</b>. It&apos;s backed by holding entities invested in the company, but gives
          you <b>no shareholder rights</b>.
        </li>
        <li>
          You can <b>sell on-chain at any time</b>, IPO or not. Liquidity decides your price and how fast you get out.
        </li>
        <li>
          At the IPO nothing happens automatically: the token becomes <b>convertible</b>, on-chain and without KYC, into a
          tokenized version of the public stock. Conversion fees may apply.
        </li>
        <li>
          Expect a <b>lockup</b>, typically 6 months, with limited liquidity and possibly a <b>discount</b> to the stock.
        </li>
        <li>
          <b>Convert within 9 months of the IPO</b>, or the token expires worthless.
        </li>
        <li>
          If the company is bought instead, a cash deal is paid out in <b>USDC</b> you convert into; a deal in shares may let you
          convert into the buyer&apos;s tokenized shares. Either way there&apos;s a <b>6-month</b> window.
        </li>
      </ul>
      <p className="muted" style={{ fontSize: 12.5 }}>
        From{" "}
        <a href={FAQ} target="_blank" rel="noreferrer">
          PreStocks&apos; FAQ
        </a>
        , read September 2026. It says &ldquo;may&rdquo; and &ldquo;typically&rdquo; for a reason: when a company announces its IPO,
        check PreStocks&apos; page for that company for its own dates. Not financial advice.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link href="/" className="btn">
          Make this week&apos;s calls →
        </Link>
        <button className="btn ghost" type="button" onClick={onRestart}>
          Start again
        </button>
      </div>
    </section>
  );
}
