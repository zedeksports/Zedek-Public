import { NextResponse } from "next/server";

const VISITOR_COOKIE = "zedek_visitor_id";
const SESSION_COOKIE = "zedek_session_id";
const SESSION_TTL = 30 * 60;

function id() {
  return crypto.randomUUID();
}

export function middleware(request, event) {
  const pathname = request.nextUrl.pathname;
  const isDocument = !pathname.startsWith("/_next/") &&
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/favicon") &&
    !pathname.includes(".");
  if (!isDocument) return NextResponse.next();

  const visitorId = request.cookies.get(VISITOR_COOKIE)?.value || id();
  const existingSession = request.cookies.get(SESSION_COOKIE)?.value;
  const sessionId = existingSession || id();
  const eventType = existingSession ? "page_view" : "session_start";

  const response = NextResponse.next();
  if (!request.cookies.get(VISITOR_COOKIE)) {
    response.cookies.set(VISITOR_COOKIE, visitorId, { maxAge: 60 * 60 * 24 * 365, httpOnly: true, sameSite: "lax", secure: true, path: "/" });
  }
  response.cookies.set(SESSION_COOKIE, sessionId, { maxAge: SESSION_TTL, httpOnly: true, sameSite: "lax", secure: true, path: "/" });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    event.waitUntil(fetch(url + "/rest/v1/site_analytics_events", {
      method: "POST",
      headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        visitor_id: visitorId,
        session_id: sessionId,
        event_type: eventType,
        page_path: pathname.slice(0, 512),
        page_title: null,
        referrer: request.headers.get("referer") ? new URL(request.headers.get("referer")).origin : null,
        device_type: "unknown"
      })
    }).catch(() => {}));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"]
};
