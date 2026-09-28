import { NextResponse } from "next/server";
import { requireRole, errorResponse, ApiError } from "@/lib/auth";
import { removeStock } from "@/lib/services/stock";
import { logAction } from "@/lib/services/auditLog";

export async function POST(request) {
  try {
    const session = await requireRole(request, ["STAFF", "MANAGER", "ADMIN"]);

    const body = await request.json().catch(() => ({}));
    const { itemId, roomId, quantity, note, date } = body;
    if (!itemId || !roomId) {
      throw new ApiError(400, "itemId and roomId are required");
    }

    // Only ADMIN users may backdate/correct a movement's date — everyone
    // else gets the default of "now", even if they somehow send `date`.
    const occurredAt = session.role === "ADMIN" ? date : undefined;

    const row = await removeStock({
      itemId,
      roomId,
      quantity: Number(quantity),
      note,
      userId: session.sub,
      occurredAt,
    });

    await logAction({
      userId: session.sub,
      action: "STOCK_REMOVE",
      entityType: "Item",
      entityId: itemId,
      details: `Removed ${Number(quantity)} unit(s) of "${row.itemName}" from ${row.roomCode}${note ? ` — ${note}` : ""}`,
    });

    return NextResponse.json(row);
  } catch (err) {
    return errorResponse(err);
  }
}
