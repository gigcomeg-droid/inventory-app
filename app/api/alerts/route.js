import { NextResponse } from "next/server";
import { getSession, requireRole, errorResponse } from "@/lib/auth";
import { listAlerts } from "@/lib/services/alerts";

export async function GET(request) {
  try {
    const session = getSession(request);
    requireRole(session);

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId") || undefined;
    const resolvedParam = searchParams.get("resolved");
    let resolved;
    if (resolvedParam === "true") resolved = true;
    else if (resolvedParam === "false") resolved = false;

    const alerts = await listAlerts({ roomId, resolved });
    return NextResponse.json(alerts);
  } catch (err) {
    return errorResponse(err);
  }
}
