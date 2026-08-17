import { NextResponse } from "next/server";
import { getSession, requireRole, errorResponse } from "@/lib/auth";
import { listUsers, createUser } from "@/lib/services/users";

export async function GET(request) {
  try {
    const session = getSession(request);
    requireRole(session, ["ADMIN"]);

    const users = await listUsers();
    return NextResponse.json(users);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request) {
  try {
    const session = getSession(request);
    requireRole(session, ["ADMIN"]);

    const body = await request.json().catch(() => ({}));
    const user = await createUser(body);
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
