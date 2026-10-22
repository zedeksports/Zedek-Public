'use client';

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

const VISITOR_KEY = "zedek_analytics_visitor_id";
const SESSION_KEY = "zedek_analytics_session";
const SESSION_TTL = 30 * 60 * 1000;
const HEARTBEAT_MS = 60 * 1000;

function makeId() {
  try { return crypto.randomUUID(); }
  catch { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
}

function deviceType() {
  const width = window.innerWidth;
  return width < 768 ? "mobile" : width < 1024 ? "tablet" : "desktop";
}

function getVisitorId() {
  let value = localStorage.getItem(VISITOR_KEY);
  if (!value) {
    value = makeId();
    localStorage.setItem(VISITOR_KEY, value);
  }
  return value;
}

function getSession() {
  const now = Date.now();
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (saved?.id && Number(saved.lastActivity) > now - SESSION_TTL) {
      saved.lastActivity = now;
      localStorage.setItem(SESSION_KEY, JSON.stringify(saved));
      return { id: saved.id, isNew: false };
    }
  } catch {}
  const fresh = { id: makeId(), lastActivity: now };
  localStorage.setItem(SESSION_KEY, JSON.stringify(fresh));
  return { id: fresh.id, isNew: true };
}

export default function SiteAnalyticsTracker() {
  const pathname = usePathname();
  const visitorRef = useRef(null);
  const sessionRef = useRef(null);
  const supabaseRef = useRef(null);
  const lastTrackedPathRef = useRef(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabaseRef.current = supabase;
    visitorRef.current = getVisitorId();
    sessionRef.current = getSession();

    const send = async (eventType, path) => {
      if (!visitorRef.current || !sessionRef.current?.id) return;
      const eventKey = eventType === "page_view" ? makeId() : null;
      const { error } = await supabase.from("site_analytics_events").insert({
        visitor_id: visitorRef.current,
        session_id: sessionRef.current.id,
        event_type: eventType,
        page_path: path || window.location.pathname || "/",
        occurred_at: new Date().toISOString(),
        page_title: document.title || null,
        referrer: document.referrer || null,
        device_type: deviceType(),
        event_key: eventKey
      });
      if (error && process.env.NODE_ENV !== "production") {
        console.warn("ZEDEK site analytics event could not be recorded:", error.message);
      }
    };

    if (sessionRef.current.isNew) send("session_start", window.location.pathname || "/");

    const heartbeat = window.setInterval(() => {
      sessionRef.current = getSession();
      send("session_heartbeat", window.location.pathname || "/");
    }, HEARTBEAT_MS);

    return () => window.clearInterval(heartbeat);
  }, []);

  useEffect(() => {
    if (!supabaseRef.current || !visitorRef.current || !pathname) return;
    // The pathname effect is the single source of page_view events. This guard
    // also prevents React Strict Mode's repeated mount effect from counting the
    // same initial route twice.
    if (lastTrackedPathRef.current === pathname) return;
    lastTrackedPathRef.current = pathname;

    const session = getSession();
    sessionRef.current = session;
    supabaseRef.current.from("site_analytics_events").insert({
      visitor_id: visitorRef.current,
      session_id: session.id,
      event_type: "page_view",
      page_path: pathname,
      occurred_at: new Date().toISOString(),
      page_title: document.title || null,
      referrer: document.referrer || null,
      device_type: deviceType(),
      // event_key is globally unique; using only pathname caused collisions
      // whenever different visitors opened the same route.
      event_key: makeId()
    }).then(({ error }) => {
      if (error && process.env.NODE_ENV !== "production") {
        console.warn("ZEDEK page-view analytics could not be recorded:", error.message);
      }
    });
  }, [pathname]);

  return null;
}
