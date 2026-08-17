import { NextResponse } from "next/server";
import { getSession, requireRole, errorResponse } from "@/lib/auth";
import { updateCategory, deleteCategory } from "@/lib/services/categories";

export async function PUT(request, { params }) {
  try {
    const session = getSession(request);
    requireRole(session, ["MANAGER", "ADMIN"]);

    const body = await request.json().catch(() => ({}));
    const category = await updateCategory(params.id, body);
    return NextResponse.json(category);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = getSession(request);
    requireRole(session, ["MANAGER", "ADMIN"]);

    const result = await deleteCategory(params.id);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
