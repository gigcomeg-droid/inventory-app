// Auth helpers: password hashing, JWT session tokens, cookie helpers,
// session extraction, and role enforcement.
//
// NOTE: this module is imported from Next.js Route Handlers (Node.js
// runtime) — it is NOT imported from middleware.js, because jsonwebtoken
// relies on Node's `crypto` module which is unavailable in the Edge
// runtime that middleware.js runs under. middleware.js only does a cheap
// "cookie present?" check for redirect UX; every route handler still calls
// getSession()/requireRole() here to do full JWT verification + role
// enforcement, which is the actual security boundary.
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE_NAME = "session";

const SESSION_MAX_AGE = parseInt(process.env.SESSION_MAX_AGE || "28800", 10);

const ROLE_RANK = { VIEWER: 0, STAFF: 1, MANAGER: 2, ADMIN: 3 };

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Fail loudly rather than silently signing with an empty/undefined secret.
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return secret;
}

// -- Password hashing --------------------------------------------------

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

// -- JWT sign / verify ---------------------------------------------------

export function signSessionToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, getJwtSecret(), {
    expiresIn: SESSION_MAX_AGE,
  });
}

export function verifySessionToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (err) {
    return null;
  }
}

// -- Cookie helpers --------------------------------------------------------

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

// Attaches the session cookie to a NextResponse.
export function setSessionCookie(response, token) {
  response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
  return response;
}

// Clears the session cookie on a NextResponse.
export function clearSessionCookie(response) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}

// -- Session extraction ------------------------------------------------

// Reads + verifies the session JWT from a NextRequest (route handlers).
// Returns { sub, role } or null.
export function getSession(request) {
  const token = request?.cookies?.get?.(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

// Reads + verifies the session JWT via next/headers cookies() — for use in
// contexts where a NextRequest isn't available (e.g. server components).
// Dynamically imports next/headers so this file stays safely importable
// from any context.
export async function getSessionFromCookies() {
  const { cookies } = await import("next/headers");
  const store = cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

// Loads the full current user row (minus passwordHash) for a request.
export async function getCurrentUser(request) {
  const session = getSession(request);
  if (!session?.sub) return null;
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user || !user.isActive) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

// -- Role enforcement --------------------------------------------------

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Verifies the request's session cookie AND re-fetches the user's CURRENT
// role/active status from the database on every call. This intentionally
// does NOT trust session.role from the JWT payload alone: the JWT is only
// re-issued at login, so a role change or deactivation made by an admin
// would otherwise have zero effect on that user's already-issued cookie
// until it naturally expires (up to SESSION_MAX_AGE, 8h by default). Throws
// ApiError(401) when there's no valid session or the account is no longer
// active, ApiError(403) when the CURRENT role isn't in allowedRoles.
// Returns { sub, role } using the fresh DB role, so call sites can do
// `const session = await requireRole(request, [...])` exactly like before.
export async function requireRole(request, allowedRoles) {
  const session = getSession(request);
  if (!session?.sub) {
    throw new ApiError(401, "Authentication required");
  }
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) {
    throw new ApiError(401, "Your session is no longer valid. Please sign in again.");
  }
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    throw new ApiError(403, "You do not have permission to perform this action");
  }
  return { sub: user.id, role: user.role };
}

export function hasRoleAtLeast(role, minRole) {
  return (ROLE_RANK[role] ?? -1) >= (ROLE_RANK[minRole] ?? 99);
}

// Uniform { error } JSON response helper for route handlers' catch blocks.
export function errorResponse(err) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
