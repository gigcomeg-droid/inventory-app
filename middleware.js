// Route protection. Runs on the Edge runtime, so it intentionally does NOT
// import lib/auth.js (jsonwebtoken needs Node's `crypto`, unavailable on
// Edge). It only checks whether a session cookie is present:
//   - present  -> let the request through; the real JWT verification +
//                 role check happens in each API route handler via
//                 getSession()/requireRole() (lib/auth.js), and in pages
//                 via getSessionFromCookies().
//   - missing  -> redirect page requests to /login, return 401 JSON for
//                 API requests.
import { NextResponse } from "next/server";

// Keep in sync with SESSION_COOKIE_NAME in lib/auth.js.
const SESSION_COOKIE_NAME = "session";

// Only these are reachable without a session cookie. /api/backups/run is
// the scheduled-backup cron endpoint (see app/api/backups/run/route.js) —
// Vercel Cron calls it with an `Authorization: Bearer <CRON_SECRET>` header
// and no cookies at all, so it must bypass this cookie check; the route
// handler itself enforces CRON_SECRET and fails closed if it's unset.
const PUBLIC_PATHS = new Set(["/login", "/api/auth/login", "/api/backups/run"]);

export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (hasSession) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

// Exclude Next.js internals and static assets (including uploaded photos
// served from /public/uploads) from auth enforcement.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads/).*)"],
};
