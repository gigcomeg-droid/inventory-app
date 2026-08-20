import { NextResponse } from "next/server";
import { clearSessionCookie, getSession } from "@/lib/auth";
import { logAction } from "@/lib/services/auditLog";

export async function POST(request) {
  const session = getSession(request);
  if (session?.sub) {
    await logAction({ userId: session.sub, action: "LOGOUT" });
  }
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
