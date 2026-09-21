"use client";
import { useSyncExternalStore } from "react";

const KEY = "precall.pid";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
let cached: string | null = null;

function readPid(): string {
  if (cached) return cached;
  let v = "";
  try {
    v = localStorage.getItem(KEY) ?? "";
  } catch {}
  if (!UUID.test(v)) {
    v = newId();
    try {
      localStorage.setItem(KEY, v);
    } catch {}
  }
  cached = v;
  return v;
}

const subscribe = () => () => {};

/**
 * The player's identity is a random id in this browser's storage. No account, no
 * wallet. It is also the player's only credential, so it is never displayed.
 * Null during server render and hydration.
 */
export function usePlayer(): string | null {
  return useSyncExternalStore(subscribe, readPid, () => null);
}
