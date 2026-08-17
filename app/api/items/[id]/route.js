import { NextResponse } from "next/server";
import { getSession, requireRole, errorResponse } from "@/lib/auth";
import { getItemById, updateItem, deleteItem } from "@/lib/services/items";

export async function GET(request, { params }) {
  try {
    const session = getSession(request);
    requireRole(session);

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
    const session = getSession(request);
    requireRole(session, ["STAFF", "MANAGER", "ADMIN"]);

    const body = await request.json().catch(() => ({}));
    const item = await updateItem(params.id, body);
    return NextResponse.json(item);
  } catch (err) {
    return errorResponse(err);
  }
}

// Soft delete — MANAGER+.
export async function DELETE(request, { params }) {
  try {
    const session = getSession(request);
    requireRole(session, ["MANAGER", "ADMIN"]);

    const result = await deleteItem(params.id);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
