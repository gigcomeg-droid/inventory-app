import { NextResponse } from "next/server";
import { getSession, requireRole, errorResponse, ApiError } from "@/lib/auth";
import { transferStock } from "@/lib/services/stock";

export async function POST(request) {
  try {
    const session = getSession(request);
    requireRole(session, ["STAFF", "MANAGER", "ADMIN"]);

    const body = await request.json().catch(() => ({}));
    const { itemId, fromRoomId, toRoomId, quantity, note } = body;
    if (!itemId || !fromRoomId || !toRoomId) {
      throw new ApiError(400, "itemId, fromRoomId and toRoomId are required");
    }

    const result = await transferStock({
      itemId,
      fromRoomId,
      toRoomId,
      quantity: Number(quantity),
      note,
      userId: session.sub,
    });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
