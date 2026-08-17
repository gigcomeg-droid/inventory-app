import { NextResponse } from "next/server";
import { getSession, requireRole, errorResponse } from "@/lib/auth";
import { updateUser } from "@/lib/services/users";

export async function PUT(request, { params }) {
  try {
    const session = getSession(request);
    requireRole(session, ["ADMIN"]);

    const body = await request.json().catch(() => ({}));
    const user = await updateUser(params.id, body, session.sub);
    return NextResponse.json(user);
  } catch (err) {
    return errorResponse(err);
  }
}
