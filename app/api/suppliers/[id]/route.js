import { NextResponse } from "next/server";
import { getSession, requireRole, errorResponse } from "@/lib/auth";
import { updateSupplier, deleteSupplier } from "@/lib/services/suppliers";

export async function PUT(request, { params }) {
  try {
    const session = getSession(request);
    requireRole(session, ["MANAGER", "ADMIN"]);

    const body = await request.json().catch(() => ({}));
    const supplier = await updateSupplier(params.id, body);
    return NextResponse.json(supplier);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = getSession(request);
    requireRole(session, ["MANAGER", "ADMIN"]);

    const result = await deleteSupplier(params.id);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
