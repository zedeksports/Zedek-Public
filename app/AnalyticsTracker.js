"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const GLOBAL_KEY = "__zedek_last_analytics_navigation__";

function navigationKey(pathname, search) {
  return `${pathname || "/"}?${search || ""}`;
}

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() || "";
  const key = navigationKey(pathname, search);

  useEffect(() => {
    if (window[GLOBAL_KEY] === key) return;
    window[GLOBAL_KEY] = key;

    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({
        event_type: "page_view",
        page_path: key.slice(0, 512),
        event_key: crypto.randomUUID().replace(/-/g, "")
      })
    }).catch(() => {});
  }, [key]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        keepalive: true,
        body: JSON.stringify({
          event_type: "session_heartbeat",
          page_path: key.slice(0, 512),
          event_key: crypto.randomUUID().replace(/-/g, "")
        })
      }).catch(() => {});
    }, 60000);

    return () => window.clearInterval(timer);
  }, [key]);

  return null;
}
