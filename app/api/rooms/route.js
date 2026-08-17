import { NextResponse } from "next/server";
import { getSession, requireRole, errorResponse } from "@/lib/auth";
import { listRooms, createRoom } from "@/lib/services/rooms";

export async function GET(request) {
  try {
    const session = getSession(request);
    requireRole(session); // any authenticated role can read

    const rooms = await listRooms();
    return NextResponse.json(rooms);
  } catch (err) {
    return errorResponse(err);
  }
}

// Add a new storage room — ADMIN only.
export async function POST(request) {
  try {
    const session = getSession(request);
    requireRole(session, ["ADMIN"]);

    const body = await request.json().catch(() => ({}));
    const room = await createRoom(body);
    return NextResponse.json(room, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
