import { NextResponse } from "next/server";
import { requireRole, errorResponse } from "@/lib/auth";
import { updateSupplier, deleteSupplier } from "@/lib/services/suppliers";
import { logAction } from "@/lib/services/auditLog";

export async function PUT(request, { params }) {
  try {
    const session = await requireRole(request, ["MANAGER", "ADMIN"]);

    const body = await request.json().catch(() => ({}));
    const supplier = await updateSupplier(params.id, body);

    await logAction({
      userId: session.sub,
      action: "SUPPLIER_UPDATE",
      entityType: "Supplier",
      entityId: supplier.id,
      details: `Updated supplier "${supplier.name}"`,
    });

    return NextResponse.json(supplier);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await requireRole(request, ["MANAGER", "ADMIN"]);

    const result = await deleteSupplier(params.id);

    await logAction({
      userId: session.sub,
      action: "SUPPLIER_DELETE",
      entityType: "Supplier",
      entityId: result.id,
    });

    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
