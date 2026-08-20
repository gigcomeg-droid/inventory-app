import { NextResponse } from "next/server";
import { requireRole, errorResponse } from "@/lib/auth";
import { listUsers, createUser } from "@/lib/services/users";
import { logAction } from "@/lib/services/auditLog";

export async function GET(request) {
  try {
    const session = await requireRole(request, ["ADMIN"]);

    const users = await listUsers();
    return NextResponse.json(users);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request) {
  try {
    const session = await requireRole(request, ["ADMIN"]);

    const body = await request.json().catch(() => ({}));
    const user = await createUser(body);

    await logAction({
      userId: session.sub,
      action: "USER_CREATE",
      entityType: "User",
      entityId: user.id,
      details: `Created user "${user.username}" (${user.role})`,
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
