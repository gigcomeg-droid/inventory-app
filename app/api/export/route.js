import { NextResponse } from "next/server";
import { requireRole, errorResponse, ApiError } from "@/lib/auth";
import {
  buildItemsExport,
  buildMovementsExport,
  buildRoomExport,
  contentTypeFor,
  filenameFor,
} from "@/lib/csv";

export async function GET(request) {
  try {
    const session = await requireRole(request); // VIEWER+ can export

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "items";
    const format = searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
    const roomId = searchParams.get("roomId") || undefined;

    let buffer;
    let roomCode;

    if (type === "items") {
      buffer = await buildItemsExport(format);
    } else if (type === "movements") {
      buffer = await buildMovementsExport(format);
    } else if (type === "room") {
      if (!roomId) throw new ApiError(400, "roomId is required for type=room");
      const built = await buildRoomExport(roomId, format);
      buffer = built.buffer;
      roomCode = built.room.code;
    } else {
      throw new ApiError(400, "type must be one of: items, movements, room");
    }

    const filename = filenameFor(type, format, roomCode);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(format),
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
