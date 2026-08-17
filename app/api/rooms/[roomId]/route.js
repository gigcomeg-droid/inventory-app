import { NextResponse } from "next/server";
import { getSession, requireRole, errorResponse } from "@/lib/auth";
import { getRoomDetail, updateRoom, deleteRoom } from "@/lib/services/rooms";

export async function GET(request, { params }) {
  try {
    const session = getSession(request);
    requireRole(session);

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
    const session = getSession(request);
    requireRole(session, ["ADMIN"]);

    const body = await request.json().catch(() => ({}));
    const room = await updateRoom(params.roomId, body);
    return NextResponse.json(room);
  } catch (err) {
    return errorResponse(err);
  }
}

// Delete (soft-delete) a storage room — ADMIN only. Refused if the room
// still holds any stock (see lib/services/rooms.js#deleteRoom).
export async function DELETE(request, { params }) {
  try {
    const session = getSession(request);
    requireRole(session, ["ADMIN"]);

    const result = await deleteRoom(params.roomId);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
