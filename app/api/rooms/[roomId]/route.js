import { NextResponse } from "next/server";
import { requireRole, errorResponse } from "@/lib/auth";
import { getRoomDetail, updateRoom, deleteRoom } from "@/lib/services/rooms";
import { logAction } from "@/lib/services/auditLog";

export async function GET(request, { params }) {
  try {
    const session = await requireRole(request);

    const room = await getRoomDetail(params.roomId);
    return NextResponse.json(room);
  } catch (err) {
    return errorResponse(err);
  }
}

// Edit an existing storage room's name/location/description/sortOrder —
// ADMIN only. The room `code` is intentionally immutable once created
// (it's used in URLs and stock movement history).
export async function PUT(request, { params }) {
  try {
    const session = await requireRole(request, ["ADMIN"]);

    const body = await request.json().catch(() => ({}));
    const room = await updateRoom(params.roomId, body);

    await logAction({
      userId: session.sub,
      action: "ROOM_UPDATE",
      entityType: "StorageRoom",
      entityId: room.id,
      details: `Updated room "${room.name}" (${room.code})`,
    });

    return NextResponse.json(room);
  } catch (err) {
    return errorResponse(err);
  }
}

// Delete (soft-delete) a storage room — ADMIN only. Refused if the room
// still holds any stock (see lib/services/rooms.js#deleteRoom).
export async function DELETE(request, { params }) {
  try {
    const session = await requireRole(request, ["ADMIN"]);

    const result = await deleteRoom(params.roomId);

    await logAction({
      userId: session.sub,
      action: "ROOM_DELETE",
      entityType: "StorageRoom",
      entityId: result.id,
      details: `Deleted room "${result.name}" (${result.code})`,
    });

    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
