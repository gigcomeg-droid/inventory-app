import { NextResponse } from "next/server";
import { getSession, requireRole, errorResponse } from "@/lib/auth";
import { listCategories, createCategory } from "@/lib/services/categories";

export async function GET(request) {
  try {
    const session = getSession(request);
    requireRole(session);

    const categories = await listCategories();
    return NextResponse.json(categories);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request) {
  try {
    const session = getSession(request);
    requireRole(session, ["MANAGER", "ADMIN"]);

    const body = await request.json().catch(() => ({}));
    const category = await createCategory(body);
    return NextResponse.json(category, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
