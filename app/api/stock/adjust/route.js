import { NextResponse } from "next/server";
import { getSession, requireRole, errorResponse, ApiError } from "@/lib/auth";
import { adjustStock } from "@/lib/services/stock";

export async function POST(request) {
  try {
    const session = getSession(request);
    requireRole(session, ["STAFF", "MANAGER", "ADMIN"]);

    const body = await request.json().catch(() => ({}));
    const { itemId, roomId, newQuantity, note } = body;
    if (!itemId || !roomId) {
      throw new ApiError(400, "itemId and roomId are required");
    }

    const row = await adjustStock({
      itemId,
      roomId,
      newQuantity: Number(newQuantity),
      note,
      userId: session.sub,
    });
    return NextResponse.json(row);
  } catch (err) {
    return errorResponse(err);
  }
}
