import { NextResponse } from "next/server";
import { getSession, requireRole, errorResponse, ApiError } from "@/lib/auth";
import { importInventory } from "@/lib/csv";

export async function POST(request) {
  try {
    const session = getSession(request);
    requireRole(session, ["STAFF", "MANAGER", "ADMIN"]);

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
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
