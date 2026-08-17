import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, errorResponse, ApiError } from "@/lib/auth";

export async function GET(request) {
  try {
    const session = getSession(request);
    if (!session?.sub) throw new ApiError(401, "Authentication required");

    const user = await prisma.user.findUnique({ where: { id: session.sub } });
    if (!user || !user.isActive) throw new ApiError(401, "Authentication required");

    const { passwordHash, ...safeUser } = user;
    return NextResponse.json({ user: safeUser });
  } catch (err) {
    return errorResponse(err);
  }
}
