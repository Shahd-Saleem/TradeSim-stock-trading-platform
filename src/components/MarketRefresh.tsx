"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Refresh server snapshots without a full page reload. Hidden tabs do no polling. */
export function MarketRefresh() {
  const router = useRouter();
  useEffect(() => {
    let last = 0;
    const refresh = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 30000)
        return;
      last = Date.now();
      router.refresh();
    };
    const timer = window.setInterval(refresh, 5 * 60 * 1000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  return null;
}
