import { NextResponse } from "next/server";
import { requireRole, errorResponse } from "@/lib/auth";
import { updateCategory, deleteCategory } from "@/lib/services/categories";
import { logAction } from "@/lib/services/auditLog";

export async function PUT(request, { params }) {
  try {
    const session = await requireRole(request, ["MANAGER", "ADMIN"]);

    const body = await request.json().catch(() => ({}));
    const category = await updateCategory(params.id, body);

    await logAction({
      userId: session.sub,
      action: "CATEGORY_UPDATE",
      entityType: "Category",
      entityId: category.id,
      details: `Updated category "${category.name}"`,
    });

    return NextResponse.json(category);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await requireRole(request, ["MANAGER", "ADMIN"]);

    const result = await deleteCategory(params.id);

    await logAction({
      userId: session.sub,
      action: "CATEGORY_DELETE",
      entityType: "Category",
      entityId: result.id,
    });

    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
