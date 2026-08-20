import { NextResponse } from "next/server";
import { requireRole, errorResponse } from "@/lib/auth";
import { listCategories, createCategory } from "@/lib/services/categories";
import { logAction } from "@/lib/services/auditLog";

export async function GET(request) {
  try {
    const session = await requireRole(request);

    const categories = await listCategories();
    return NextResponse.json(categories);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request) {
  try {
    const session = await requireRole(request, ["MANAGER", "ADMIN"]);

    const body = await request.json().catch(() => ({}));
    const category = await createCategory(body);

    await logAction({
      userId: session.sub,
      action: "CATEGORY_CREATE",
      entityType: "Category",
      entityId: category.id,
      details: `Created category "${category.name}"`,
    });

    return NextResponse.json(category, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
