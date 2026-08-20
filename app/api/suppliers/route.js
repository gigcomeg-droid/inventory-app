import { NextResponse } from "next/server";
import { requireRole, errorResponse } from "@/lib/auth";
import { listSuppliers, createSupplier } from "@/lib/services/suppliers";
import { logAction } from "@/lib/services/auditLog";

export async function GET(request) {
  try {
    const session = await requireRole(request);

    const suppliers = await listSuppliers();
    return NextResponse.json(suppliers);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request) {
  try {
    const session = await requireRole(request, ["MANAGER", "ADMIN"]);

    const body = await request.json().catch(() => ({}));
    const supplier = await createSupplier(body);

    await logAction({
      userId: session.sub,
      action: "SUPPLIER_CREATE",
      entityType: "Supplier",
      entityId: supplier.id,
      details: `Created supplier "${supplier.name}"`,
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
