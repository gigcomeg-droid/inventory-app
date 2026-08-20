import { NextResponse } from "next/server";
import { requireRole, errorResponse } from "@/lib/auth";
import { updateUser } from "@/lib/services/users";
import { logAction } from "@/lib/services/auditLog";

export async function PUT(request, { params }) {
  try {
    const session = await requireRole(request, ["ADMIN"]);

    const body = await request.json().catch(() => ({}));
    const user = await updateUser(params.id, body, session.sub);

    const changes = [];
    if ("name" in body) changes.push(`name → "${user.name}"`);
    if ("role" in body) changes.push(`role → ${user.role}`);
    if ("isActive" in body) changes.push(user.isActive ? "re-activated" : "deactivated");
    if ("password" in body && body.password) changes.push("password reset");

    await logAction({
      userId: session.sub,
      action: "USER_UPDATE",
      entityType: "User",
      entityId: user.id,
      details: `Updated user "${user.username}"${changes.length ? ` — ${changes.join(", ")}` : ""}`,
    });

    return NextResponse.json(user);
  } catch (err) {
    return errorResponse(err);
  }
}
