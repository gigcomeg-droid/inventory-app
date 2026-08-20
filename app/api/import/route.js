import { NextResponse } from "next/server";
import { requireRole, errorResponse, ApiError } from "@/lib/auth";
import { importInventory } from "@/lib/csv";
import { logAction } from "@/lib/services/auditLog";

export async function POST(request) {
  try {
    const session = await requireRole(request, ["STAFF", "MANAGER", "ADMIN"]);

    const formData = await request.formData();
    const file = formData.get("file");
    const roomId = formData.get("roomId");

    if (!file || typeof file === "string") {
      throw new ApiError(400, "file (csv or xlsx) is required");
    }
    if (!roomId) {
      throw new ApiError(400, "roomId is required");
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await importInventory({ buffer, roomId, userId: session.sub });

    await logAction({
      userId: session.sub,
      action: "IMPORT_CSV",
      entityType: "StorageRoom",
      entityId: roomId,
      details: `Imported file: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`,
    });

    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
