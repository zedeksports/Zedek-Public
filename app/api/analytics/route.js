import { cookies } from "next/headers";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

const VISITOR_COOKIE = "zedek_visitor_id";
const SESSION_COOKIE = "zedek_session_id";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365;
const SESSION_MAX_AGE = 60 * 30;

function id() {
  return crypto.randomUUID().replace(/-/g, "");
}

function cleanPath(value) {
  if (typeof value !== "string") return "/";
  const path = value.trim();
  if (!path.startsWith("/") || path.length > 512) return "/";
  return path;
}

function deviceType(userAgent) {
  const ua = String(userAgent || "").toLowerCase();
  if (/tablet|ipad|android(?!.*mobile)/.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android.*mobile/.test(ua)) return "mobile";
  if (ua) return "desktop";
  return "unknown";
}

function referrerOrigin(value) {
  try {
    return value ? new URL(value).origin : null;
  } catch {
    return null;
  }
}

function setCookie(store, name, value, maxAge) {
  store.set(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge
  });
}

export async function POST(request) {
  if (request.headers.get("content-type")?.includes("application/json") !== true) {
    return Response.json({ ok: false }, { status: 415 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const eventType = body?.event_type;
  if (!["page_view", "session_heartbeat"].includes(eventType)) {
    return Response.json({ ok: false }, { status: 400 });
  }

  const pagePath = cleanPath(body?.page_path);
  const eventKey = typeof body?.event_key === "string" ? body.event_key.trim() : "";
  if (!/^[a-zA-Z0-9]{16,128}$/.test(eventKey)) {
    return Response.json({ ok: false }, { status: 400 });
  }

  const store = await cookies();
  let visitorId = store.get(VISITOR_COOKIE)?.value;
  let sessionId = store.get(SESSION_COOKIE)?.value;
  const newVisitor = !visitorId;
  const newSession = !sessionId;

  if (!visitorId) visitorId = id();
  if (!sessionId) sessionId = id();

  const supabase = createSupabaseServerClient();
  const userAgent = request.headers.get("user-agent");
  const referrer = referrerOrigin(request.headers.get("referer"));

  const events = [];
  if (newSession) {
    events.push({
      visitor_id: visitorId,
      session_id: sessionId,
      event_type: "session_start",
      page_path: pagePath,
      event_key: eventKey + ":session",
      referrer,
      device_type: deviceType(userAgent)
    });
  }

  events.push({
    visitor_id: visitorId,
    session_id: sessionId,
    event_type: eventType,
    page_path: pagePath,
    event_key: eventKey,
    referrer,
    device_type: deviceType(userAgent)
  });

  const { error } = await supabase.from("site_analytics_events").upsert(events, {
    onConflict: "event_key",
    ignoreDuplicates: true
  });

  if (error) {
    return Response.json({ ok: false }, { status: 500 });
  }

  if (newVisitor) setCookie(store, VISITOR_COOKIE, visitorId, VISITOR_MAX_AGE);
  // Refresh the rolling 30-minute session window on every accepted event.
  setCookie(store, SESSION_COOKIE, sessionId, SESSION_MAX_AGE);

  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
