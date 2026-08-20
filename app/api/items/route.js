import { NextResponse } from "next/server";
import { requireRole, errorResponse } from "@/lib/auth";
import { listItems, createItem } from "@/lib/services/items";
import { logAction } from "@/lib/services/auditLog";

export async function GET(request) {
  try {
    const session = await requireRole(request);

    const { searchParams } = new URL(request.url);
    const items = await listItems({
      search: searchParams.get("search") || undefined,
      category: searchParams.get("category") || undefined,
      supplier: searchParams.get("supplier") || undefined,
      lowStockOnly: searchParams.get("lowStockOnly") === "true",
    });
    return NextResponse.json(items);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request) {
  try {
    const session = await requireRole(request, ["STAFF", "MANAGER", "ADMIN"]);

    const body = await request.json().catch(() => ({}));
    const item = await createItem(body, session.sub);

    await logAction({
      userId: session.sub,
      action: "ITEM_CREATE",
      entityType: "Item",
      entityId: item.id,
      details: `Created item "${item.name}" (SKU ${item.sku})`,
    });

    // createItem() can seed InventoryByRoom rows via body.initialStock —
    // that's a real stock movement (and is recorded in StockMovement), so
    // it needs its own audit-log entry per room, same as the dedicated
    // /api/stock/add endpoint, instead of disappearing into just ITEM_CREATE.
    if (Array.isArray(item.perRoom)) {
      for (const room of item.perRoom) {
        if (room.quantity > 0) {
          await logAction({
            userId: session.sub,
            action: "STOCK_ADD",
            entityType: "InventoryByRoom",
            entityId: item.id,
            details: `Seeded ${room.quantity} unit(s) of "${item.name}" into ${room.roomCode} (initial stock)`,
          });
        }
      }
    }

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
