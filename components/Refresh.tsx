"use client";

import { useEffect } from "react";

/** Nudges the background refresh once per page load (crawlers do not run it). */
export function Refresh() {
  useEffect(() => {
    fetch("/api/refresh", { method: "POST", keepalive: true }).catch(() => {});
  }, []);
  return null;
}
