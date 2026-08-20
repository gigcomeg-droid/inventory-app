import { NextResponse } from "next/server";
import { requireRole, errorResponse } from "@/lib/auth";
import { listAuditLog, listAuditLogUsers, AUDIT_ACTIONS } from "@/lib/services/auditLog";

// ADMIN only — this is the "who did what" record, not something every
// role should be able to browse.
export async function GET(request) {
  try {
    const session = await requireRole(request, ["ADMIN"]);

    const { searchParams } = new URL(request.url);

    if (searchParams.get("meta") === "filters") {
      const users = await listAuditLogUsers();
      return NextResponse.json({ users, actions: AUDIT_ACTIONS });
    }

    const result = await listAuditLog({
      userId: searchParams.get("userId") || undefined,
      action: searchParams.get("action") || undefined,
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      page: searchParams.get("page") || undefined,
      pageSize: searchParams.get("pageSize") || undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
