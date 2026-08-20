import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  verifyPassword,
  signSessionToken,
  setSessionCookie,
  errorResponse,
  ApiError,
} from "@/lib/auth";
import { logAction } from "@/lib/services/auditLog";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { username, password } = body;

    if (!username || !password) {
      throw new ApiError(400, "username and password are required");
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) {
      await logAction({
        action: "LOGIN_FAILED",
        details: `Failed login attempt for username "${username}"`,
      });
      throw new ApiError(401, "Invalid username or password");
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await logAction({
        userId: user.id,
        action: "LOGIN_FAILED",
        details: `Failed login attempt for username "${username}"`,
      });
      throw new ApiError(401, "Invalid username or password");
    }

    const token = signSessionToken(user);
    const { passwordHash, ...safeUser } = user;

    await logAction({ userId: user.id, action: "LOGIN" });

    const response = NextResponse.json({ user: safeUser });
    setSessionCookie(response, token);
    return response;
  } catch (err) {
    return errorResponse(err);
  }
}
