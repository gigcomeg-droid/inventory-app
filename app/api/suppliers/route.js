import { NextResponse } from "next/server";
import { getSession, requireRole, errorResponse } from "@/lib/auth";
import { listSuppliers, createSupplier } from "@/lib/services/suppliers";

export async function GET(request) {
  try {
    const session = getSession(request);
    requireRole(session);

    const suppliers = await listSuppliers();
    return NextResponse.json(suppliers);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request) {
  try {
    const session = getSession(request);
    requireRole(session, ["MANAGER", "ADMIN"]);

    const body = await request.json().catch(() => ({}));
    const supplier = await createSupplier(body);
    return NextResponse.json(supplier, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
