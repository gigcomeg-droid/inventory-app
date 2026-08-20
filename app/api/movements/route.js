import { NextResponse } from "next/server";
import { requireRole, errorResponse } from "@/lib/auth";
import { listMovements } from "@/lib/services/movements";

export async function GET(request) {
  try {
    const session = await requireRole(request);

    const { searchParams } = new URL(request.url);
    const movements = await listMovements({
      itemId: searchParams.get("itemId") || undefined,
      roomId: searchParams.get("roomId") || undefined,
      type: searchParams.get("type") || undefined,
      limit: searchParams.get("limit") || undefined,
      before: searchParams.get("before") || undefined,
    });
    return NextResponse.json(movements);
  } catch (err) {
    return errorResponse(err);
  }
}
