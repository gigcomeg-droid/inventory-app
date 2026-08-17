import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";

export async function listCategories() {
  return prisma.category.findMany({ orderBy: { name: "asc" } });
}

export async function createCategory(data) {
  const name = data?.name?.trim();
  if (!name) throw new ApiError(400, "name is required");

  const existing = await prisma.category.findUnique({ where: { name } });
  if (existing) throw new ApiError(409, `Category "${name}" already exists`);

  return prisma.category.create({
    data: { name, description: data.description || null },
  });
}

export async function updateCategory(id, data) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Category not found");

  if (data.name && data.name.trim() !== existing.name) {
    const conflict = await prisma.category.findUnique({ where: { name: data.name.trim() } });
    if (conflict) throw new ApiError(409, `Category "${data.name}" already exists`);
  }

  const updateData = {};
  for (const field of ["name", "description"]) {
    if (field in data) updateData[field] = field === "name" ? data.name.trim() : data[field];
  }

  return prisma.category.update({ where: { id }, data: updateData });
}

export async function deleteCategory(id) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Category not found");

  const itemCount = await prisma.item.count({ where: { categoryId: id } });
  if (itemCount > 0) {
    throw new ApiError(
      409,
      `Cannot delete category: ${itemCount} item(s) still reference it`
    );
  }

  await prisma.category.delete({ where: { id } });
  return { id };
}
