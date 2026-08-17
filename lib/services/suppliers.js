import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";

export async function listSuppliers() {
  return prisma.supplier.findMany({ orderBy: { name: "asc" } });
}

export async function createSupplier(data) {
  const name = data?.name?.trim();
  if (!name) throw new ApiError(400, "name is required");

  return prisma.supplier.create({
    data: {
      name,
      contactName: data.contactName || null,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      notes: data.notes || null,
    },
  });
}

export async function updateSupplier(id, data) {
  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Supplier not found");

  const updateData = {};
  for (const field of ["name", "contactName", "email", "phone", "address", "notes"]) {
    if (field in data) updateData[field] = data[field];
  }
  if ("name" in updateData && !updateData.name?.trim()) {
    throw new ApiError(400, "name cannot be empty");
  }

  return prisma.supplier.update({ where: { id }, data: updateData });
}

export async function deleteSupplier(id) {
  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Supplier not found");

  const itemCount = await prisma.item.count({ where: { supplierId: id } });
  if (itemCount > 0) {
    throw new ApiError(
      409,
      `Cannot delete supplier: ${itemCount} item(s) still reference it`
    );
  }

  await prisma.supplier.delete({ where: { id } });
  return { id };
}
