"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

const VISITOR_KEY = "zedek_analytics_visitor";
const SESSION_KEY = "zedek_analytics_session";
const SESSION_TTL_MS = 30 * 60 * 1000;

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "z_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getVisitorId() {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing && existing.length >= 16) return existing;
    const id = makeId();
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return makeId();
  }
}

function getSession() {
  const now = Date.now();
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.id && now - Number(parsed.lastSeen || 0) < SESSION_TTL_MS) {
        parsed.lastSeen = now;
        localStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
        return { id: parsed.id, fresh: false };
      }
    }
    const next = { id: makeId(), lastSeen: now };
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    return { id: next.id, fresh: true };
  } catch {
    return { id: makeId(), fresh: true };
  }
}

function deviceType() {
  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

export default function AudienceTracker() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    const visitorId = getVisitorId();
    const session = getSession();

    const send = async (eventType) => {
      if (cancelled || !pathname) return;
      await supabase.from("site_analytics_events").insert({
        visitor_id: visitorId,
        session_id: session.id,
        event_type: eventType,
        page_path: pathname.split("?")[0].slice(0, 512),
        page_title: document.title?.slice(0, 255) || null,
        referrer: document.referrer ? new URL(document.referrer).origin : null,
        device_type: deviceType(),
      });
    };

    send(session.fresh ? "session_start" : "page_view");

    const heartbeat = window.setInterval(() => {
      const current = getSession();
      if (current.id === session.id) send("session_heartbeat");
    }, 120000);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeat);
    };
  }, [pathname]);

  return null;
}
