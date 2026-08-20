import { NextResponse } from "next/server";
import { requireRole, errorResponse, ApiError } from "@/lib/auth";
import { addStock } from "@/lib/services/stock";
import { logAction } from "@/lib/services/auditLog";

export async function POST(request) {
  try {
    const session = await requireRole(request, ["STAFF", "MANAGER", "ADMIN"]);

    const body = await request.json().catch(() => ({}));
    const { itemId, roomId, quantity, note } = body;
    if (!itemId || !roomId) {
      throw new ApiError(400, "itemId and roomId are required");
    }

    const row = await addStock({
      itemId,
      roomId,
      quantity: Number(quantity),
      note,
      userId: session.sub,
    });

    await logAction({
      userId: session.sub,
      action: "STOCK_ADD",
      entityType: "Item",
      entityId: itemId,
      details: `Added ${Number(quantity)} unit(s) of "${row.itemName}" to ${row.roomCode}${note ? ` — ${note}` : ""}`,
    });

    return NextResponse.json(row);
  } catch (err) {
    return errorResponse(err);
  }
}
