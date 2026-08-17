import { NextResponse } from "next/server";
import { getSession, requireRole, errorResponse } from "@/lib/auth";
import { getRoomInventory } from "@/lib/services/rooms";

// Strictly room-scoped: only ever returns InventoryByRoom rows for this
// one roomId, never mixed with other rooms' quantities.
export async function GET(request, { params }) {
  try {
    const session = getSession(request);
    requireRole(session);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const category = searchParams.get("category") || undefined;
    const lowStockOnly = searchParams.get("lowStockOnly") === "true";

    const inventory = await getRoomInventory(params.roomId, {
      search,
      category,
      lowStockOnly,
    });
    return NextResponse.json(inventory);
  } catch (err) {
    return errorResponse(err);
  }
}
