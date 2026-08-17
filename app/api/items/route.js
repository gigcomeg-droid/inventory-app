import { NextResponse } from "next/server";
import { getSession, requireRole, errorResponse } from "@/lib/auth";
import { listItems, createItem } from "@/lib/services/items";

export async function GET(request) {
  try {
    const session = getSession(request);
    requireRole(session);

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
    const session = getSession(request);
    requireRole(session, ["STAFF", "MANAGER", "ADMIN"]);

    const body = await request.json().catch(() => ({}));
    const item = await createItem(body, session.sub);
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
