import { NextResponse } from "next/server";
import { requireRole, errorResponse, ApiError } from "@/lib/auth";
import { transferStock } from "@/lib/services/stock";
import { logAction } from "@/lib/services/auditLog";

export async function POST(request) {
  try {
    const session = await requireRole(request, ["STAFF", "MANAGER", "ADMIN"]);

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

    await logAction({
      userId: session.sub,
      action: "STOCK_TRANSFER",
      entityType: "Item",
      entityId: itemId,
      details: `Transferred ${Number(quantity)} unit(s) of "${result.itemName}" from ${result.fromRoomCode} to ${result.toRoomCode}${note ? ` — ${note}` : ""}`,
    });

    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
