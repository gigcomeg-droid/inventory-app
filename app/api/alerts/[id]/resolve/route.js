import { NextResponse } from "next/server";
import { getSession, requireRole, errorResponse, ApiError } from "@/lib/auth";
import { resolveAlert } from "@/lib/services/alerts";

export async function POST(request, { params }) {
  try {
    const session = getSession(request);
    requireRole(session, ["MANAGER", "ADMIN"]);

    const alert = await resolveAlert(params.id);
    if (!alert) throw new ApiError(404, "Alert not found");
    return NextResponse.json(alert);
  } catch (err) {
    return errorResponse(err);
  }
}
