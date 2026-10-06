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

  useEffect(() => {
    const search = searchParams?.toString() || "";
    const key = navigationKey(pathname, search);
    if (window[GLOBAL_KEY] === key) return;
    window[GLOBAL_KEY] = key;

    const controller = new AbortController();
    const eventKey = crypto.randomUUID().replace(/-/g, "");

    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      signal: controller.signal,
      body: JSON.stringify({
        event_type: "page_view",
        page_path: key.slice(0, 512),
        event_key: eventKey
      })
    }).catch(() => {});

    return () => controller.abort();
  }, [pathname, searchParams]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = navigationKey(pathname, searchParams?.toString() || "");
      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        keepalive: true,
        body: JSON.stringify({
          event_type: "session_heartbeat",
          page_path: current.slice(0, 512),
          event_key: crypto.randomUUID().replace(/-/g, "")
        })
      }).catch(() => {});
    }, 60000);

    return () => window.clearInterval(timer);
  }, [pathname, searchParams]);

  return null;
}
