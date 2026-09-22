"use client";

import { useEffect, useId, useRef, useState } from "react";
import { fmtPct, fmtPrice, jupiterUrl, signClass } from "@/lib/format";

// Jupiter Plugin (plugin.jup.ag): Jupiter's own swap UI, embedded. It brings its own
// wallet connect, so PreCall never touches keys or funds. The output mint is fixed to
// the PreStocks token, so this dialog can only ever buy (or sell) that token.

const SCRIPT = "https://plugin.jup.ag/plugin-v1.js";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

interface JupiterApi {
  init: (props: Record<string, unknown>) => void;
  close?: () => void;
}
declare global {
  interface Window {
    Jupiter?: JupiterApi;
  }
}

let loading: Promise<JupiterApi> | null = null;
function loadJupiter(): Promise<JupiterApi> {
  if (window.Jupiter) return Promise.resolve(window.Jupiter);
  loading ??= new Promise<JupiterApi>((ok, fail) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => (window.Jupiter ? ok(window.Jupiter) : fail(new Error("Jupiter did not initialise")));
    s.onerror = () => {
      loading = null;
      fail(new Error("Could not load Jupiter"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export interface BuyToken {
  symbol: string;
  name: string;
  mint: string;
  image: string | null;
  url: string | null;
  price: number | null;
  premium: number | null;
}

export function BuyButton({ token, className = "btn buy", label }: { token: BuyToken; className?: string; label?: string }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const target = `jup-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [txid, setTxid] = useState<string | null>(null);

  const open = async () => {
    dlg.current?.showModal();
    setTxid(null);
    setState("loading");
    try {
      const jup = await loadJupiter();
      jup.init({
        displayMode: "integrated",
        integratedTargetId: target,
        formProps: {
          initialInputMint: USDC,
          initialOutputMint: token.mint,
          fixedMint: token.mint,
          swapMode: "ExactIn",
        },
        branding: { name: "PreCall", logoUri: token.image ?? undefined },
        containerStyles: { maxHeight: "560px" },
        defaultExplorer: "Solscan",
        onSuccess: ({ txid }: { txid: string }) => setTxid(txid),
      });
      setState("ready");
    } catch {
      setState("error");
    }
  };

  // Closing the dialog tears the widget down so the next token starts clean.
  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    const onClose = () => {
      try {
        window.Jupiter?.close?.();
      } catch {}
      const el = document.getElementById(target);
      if (el) el.innerHTML = "";
      setState("idle");
    };
    d.addEventListener("close", onClose);
    return () => d.removeEventListener("close", onClose);
  }, [target]);

  return (
    <>
      <button type="button" className={className} onClick={open}>
        {label ?? `Buy ${token.name}`}
      </button>
      <dialog ref={dlg} className="swap-dlg" aria-label={`Swap into ${token.name}`} onClick={(e) => e.target === dlg.current && dlg.current?.close()}>
        <div className="swap-card">
          <div className="swap-head">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {token.image ? <img src={token.image} alt="" width={34} height={34} className="logo" /> : null}
            <div style={{ flex: 1 }}>
              <div className="t-name">{token.name}</div>
              <div className="t-tick">
                {token.symbol}
                {token.price !== null && <> · {fmtPrice(token.price)}</>}
                {token.premium !== null && (
                  <>
                    {" "}· <span className={signClass(token.premium)}>{fmtPct(token.premium, 1)}</span> vs PreStocks mark
                  </>
                )}
              </div>
            </div>
            <button type="button" className="swap-x" aria-label="Close" onClick={() => dlg.current?.close()}>
              ×
            </button>
          </div>
          {/* Always in the DOM, so init never races React's render. */}
          <div id={target} className="swap-body" />
          {state === "loading" && <div className="swap-msg">Loading Jupiter…</div>}
          {state === "error" && (
            <div className="swap-msg">
              Jupiter didn&apos;t load.{" "}
              <a href={jupiterUrl(token.mint)} target="_blank" rel="noreferrer">
                Open the swap on jup.ag ↗
              </a>
            </div>
          )}
          {txid && (
            <div className="swap-ok">
              Swap sent.{" "}
              <a href={`https://solscan.io/tx/${txid}`} target="_blank" rel="noreferrer">
                View on Solscan ↗
              </a>
            </div>
          )}
          <p className="swap-fine">
            Swaps run on Jupiter from your own wallet; PreCall never holds funds or keys. The output is locked to the{" "}
            {token.url ? (
              <a href={token.url} target="_blank" rel="noreferrer">
                PreStocks {token.name} token
              </a>
            ) : (
              `PreStocks ${token.name} token`
            )}
            . Pre-IPO tokens are volatile and not available everywhere: check PreStocks&apos; terms first. Not financial advice.
          </p>
        </div>
      </dialog>
    </>
  );
}
