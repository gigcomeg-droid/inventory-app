import { NextResponse } from "next/server";
import { requireRole, errorResponse } from "@/lib/auth";
import { listRooms, createRoom } from "@/lib/services/rooms";
import { logAction } from "@/lib/services/auditLog";

export async function GET(request) {
  try {
    const session = await requireRole(request); // any authenticated role can read

    const rooms = await listRooms();
    return NextResponse.json(rooms);
  } catch (err) {
    return errorResponse(err);
  }
}

// Add a new storage room — ADMIN only.
export async function POST(request) {
  try {
    const session = await requireRole(request, ["ADMIN"]);

    const body = await request.json().catch(() => ({}));
    const room = await createRoom(body);

    await logAction({
      userId: session.sub,
      action: "ROOM_CREATE",
      entityType: "StorageRoom",
      entityId: room.id,
      details: `Created room "${room.name}" (${room.code})`,
    });

    return NextResponse.json(room, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
