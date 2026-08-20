import { NextResponse } from "next/server";
import { requireRole, errorResponse } from "@/lib/auth";
import { getItemById, updateItem, deleteItem } from "@/lib/services/items";
import { logAction } from "@/lib/services/auditLog";

export async function GET(request, { params }) {
  try {
    const session = await requireRole(request);

    const item = await getItemById(params.id);
    return NextResponse.json(item);
  } catch (err) {
    return errorResponse(err);
  }
}

// Master fields only (name/sku/barcode/category/supplier/unit/
// defaultMinStockLevel/notes/photoUrl) — quantities only change via
// /api/stock/*. STAFF+ per CONTRACT.md.
export async function PUT(request, { params }) {
  try {
    const session = await requireRole(request, ["STAFF", "MANAGER", "ADMIN"]);

    const body = await request.json().catch(() => ({}));
    const item = await updateItem(params.id, body);

    await logAction({
      userId: session.sub,
      action: "ITEM_UPDATE",
      entityType: "Item",
      entityId: item.id,
      details: `Updated item "${item.name}" (SKU ${item.sku})`,
    });

    return NextResponse.json(item);
  } catch (err) {
    return errorResponse(err);
  }
}

// Soft delete — MANAGER+.
export async function DELETE(request, { params }) {
  try {
    const session = await requireRole(request, ["MANAGER", "ADMIN"]);

    const result = await deleteItem(params.id);

    await logAction({
      userId: session.sub,
      action: "ITEM_DELETE",
      entityType: "Item",
      entityId: result.id,
      details: `Deleted item "${result.name}" (SKU ${result.sku})`,
    });

    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
