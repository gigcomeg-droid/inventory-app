import { NextResponse } from "next/server";
import { requireRole, errorResponse, ApiError } from "@/lib/auth";
import { resolveAlert } from "@/lib/services/alerts";
import { logAction } from "@/lib/services/auditLog";

export async function POST(request, { params }) {
  try {
    const session = await requireRole(request, ["MANAGER", "ADMIN"]);

    const alert = await resolveAlert(params.id);
    if (!alert) throw new ApiError(404, "Alert not found");

    await logAction({
      userId: session.sub,
      action: "ALERT_RESOLVE",
      entityType: "Alert",
      entityId: alert.id,
      details: alert.message || undefined,
    });

    return NextResponse.json(alert);
  } catch (err) {
    return errorResponse(err);
  }
}
