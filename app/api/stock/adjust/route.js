import { NextResponse } from "next/server";
import { requireRole, errorResponse, ApiError } from "@/lib/auth";
import { adjustStock } from "@/lib/services/stock";
import { logAction } from "@/lib/services/auditLog";

export async function POST(request) {
  try {
    const session = await requireRole(request, ["STAFF", "MANAGER", "ADMIN"]);

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

    const sign = row.delta >= 0 ? "+" : "";
    await logAction({
      userId: session.sub,
      action: "STOCK_ADJUST",
      entityType: "Item",
      entityId: itemId,
      details: `Adjusted "${row.itemName}" in ${row.roomCode} by ${sign}${row.delta} (now ${row.quantity})${note ? ` — ${note}` : ""}`,
    });

    return NextResponse.json(row);
  } catch (err) {
    return errorResponse(err);
  }
}
