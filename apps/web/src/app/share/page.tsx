"use client";

import { useEffect } from "react";
import { INCOMING_KEY } from "@/lib/store";

/**
 * Landing point for "Share → CVTuner" (Android PWA share target, query string)
 * and the browser extension (URL fragment, which never reaches the server).
 */
export default function SharePage() {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const h = new URLSearchParams(window.location.hash.slice(1));
    const pick = (k: string) => h.get(k) ?? q.get(k) ?? undefined;
    const payload = { text: pick("text"), url: pick("url"), title: pick("title") };
    try {
      if (payload.text || payload.url) localStorage.setItem(INCOMING_KEY, JSON.stringify(payload));
    } catch {
      // storage blocked; the app opens empty
    }
    window.location.replace("/cvtuner");
  }, []);
  return <p className="p-6 text-sm">Opening CVTuner…</p>;
}
