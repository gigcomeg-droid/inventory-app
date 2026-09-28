// Item catalog service. Quantities always come from InventoryByRoom;
// `totalQuantity` (sum across all 4 rooms) is only computed here for the
// explicitly cross-room /api/items view — room-scoped views must use
// lib/services/rooms.js#getRoomInventory instead.
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
import { refreshAlertsFor } from "@/lib/services/alerts";

const ITEM_INCLUDE = {
  category: true,
  supplier: true,
  inventory: { include: { room: true } },
};

function serializeItem(item) {
  const perRoom = item.inventory
    .slice()
    .sort((a, b) => a.room.code.localeCompare(b.room.code))
    .map((row) => {
      const minStockLevel = row.minStockLevel ?? item.defaultMinStockLevel;
      return {
        roomId: row.roomId,
        roomCode: row.room.code,
        quantity: row.quantity,
        minStockLevel,
        isLowStock: row.quantity <= minStockLevel,
      };
    });

  const totalQuantity = perRoom.reduce((sum, r) => sum + r.quantity, 0);

  return {
    id: item.id,
    name: item.name,
    sku: item.sku,
    barcode: item.barcode,
    unit: item.unit,
    category: item.category ? { id: item.category.id, name: item.category.name } : null,
    supplier: item.supplier ? { id: item.supplier.id, name: item.supplier.name } : null,
    totalQuantity,
    perRoom,
    defaultMinStockLevel: item.defaultMinStockLevel,
    photoUrl: item.photoUrl,
    notes: item.notes,
    isActive: item.isActive,
  };
}

export async function listItems({ search, category, supplier, lowStockOnly } = {}) {
  const where = { isActive: true };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
      { barcode: { contains: search, mode: "insensitive" } },
    ];
  }
  if (category) where.categoryId = category;
  if (supplier) where.supplierId = supplier;

  const items = await prisma.item.findMany({
    where,
    include: ITEM_INCLUDE,
    orderBy: { name: "asc" },
  });

  let serialized = items.map(serializeItem);

  if (lowStockOnly) {
    serialized = serialized.filter((it) => it.perRoom.some((r) => r.isLowStock));
  }

  return serialized;
}

export async function getItemById(id) {
  const item = await prisma.item.findUnique({
    where: { id },
    include: ITEM_INCLUDE,
  });
  if (!item || !item.isActive) throw new ApiError(404, "Item not found");

  const recentMovements = await prisma.stockMovement.findMany({
    where: { itemId: id },
    include: {
      fromRoom: { select: { id: true, code: true, name: true } },
      toRoom: { select: { id: true, code: true, name: true } },
      user: { select: { id: true, name: true, username: true } },
    },
    // Sorted by occurredAt (the movement's actual date) rather than
    // createdAt (when it was logged) — an ADMIN-backdated entry should
    // appear where it actually happened in the timeline.
    orderBy: { occurredAt: "desc" },
    take: 20,
  });

  return { ...serializeItem(item), recentMovements };
}

export async function createItem(data, userId) {
  const {
    name,
    sku,
    barcode,
    unit,
    categoryId,
    supplierId,
    defaultMinStockLevel,
    notes,
    photoUrl,
    initialStock,
  } = data || {};

  if (!name || !String(name).trim() || !sku || !String(sku).trim()) {
    throw new ApiError(400, "name and sku are required");
  }
  if (
    defaultMinStockLevel !== undefined &&
    defaultMinStockLevel !== null &&
    !(Number.isInteger(defaultMinStockLevel) && defaultMinStockLevel >= 0)
  ) {
    throw new ApiError(400, "defaultMinStockLevel must be a non-negative integer");
  }

  const existingSku = await prisma.item.findUnique({ where: { sku } });
  if (existingSku) {
    throw new ApiError(409, `An item with sku "${sku}" already exists`);
  }
  if (barcode) {
    const existingBarcode = await prisma.item.findUnique({ where: { barcode } });
    if (existingBarcode) {
      throw new ApiError(409, `An item with barcode "${barcode}" already exists`);
    }
  }
  if (categoryId) {
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new ApiError(400, "Selected category does not exist");
  }
  if (supplierId) {
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new ApiError(400, "Selected supplier does not exist");
  }

  const item = await prisma.item.create({
    data: {
      name,
      sku,
      barcode: barcode || null,
      unit: unit || "pcs",
      categoryId: categoryId || null,
      supplierId: supplierId || null,
      defaultMinStockLevel: Number.isInteger(defaultMinStockLevel)
        ? defaultMinStockLevel
        : 0,
      notes: notes || null,
      photoUrl: photoUrl || null,
    },
  });

  if (Array.isArray(initialStock)) {
    for (const entry of initialStock) {
      const quantity = Number(entry?.quantity);
      if (!entry?.roomId || !Number.isFinite(quantity) || quantity <= 0) continue;

      const room = await prisma.storageRoom.findUnique({ where: { id: entry.roomId } });
      if (!room || !room.isActive) continue;

      await prisma.inventoryByRoom.upsert({
        where: { itemId_roomId: { itemId: item.id, roomId: entry.roomId } },
        create: { itemId: item.id, roomId: entry.roomId, quantity },
        update: { quantity: { increment: quantity } },
      });

      await prisma.stockMovement.create({
        data: {
          type: "ADD",
          itemId: item.id,
          quantity,
          toRoomId: entry.roomId,
          note: "Initial stock",
          userId: userId || null,
        },
      });

      await refreshAlertsFor(item.id, entry.roomId);
    }
  }

  return getItemById(item.id);
}

// Master-fields-only update — never touches InventoryByRoom quantities.
export async function updateItem(id, data) {
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item || !item.isActive) throw new ApiError(404, "Item not found");

  if ("name" in data && (!data.name || !String(data.name).trim())) {
    throw new ApiError(400, "name cannot be empty");
  }
  if ("sku" in data && (!data.sku || !String(data.sku).trim())) {
    throw new ApiError(400, "sku cannot be empty");
  }
  if (
    "defaultMinStockLevel" in data &&
    data.defaultMinStockLevel !== undefined &&
    data.defaultMinStockLevel !== null &&
    !(Number.isInteger(data.defaultMinStockLevel) && data.defaultMinStockLevel >= 0)
  ) {
    throw new ApiError(400, "defaultMinStockLevel must be a non-negative integer");
  }
  if (data.sku && data.sku !== item.sku) {
    const conflict = await prisma.item.findUnique({ where: { sku: data.sku } });
    if (conflict) throw new ApiError(409, `An item with sku "${data.sku}" already exists`);
  }
  if (data.barcode && data.barcode !== item.barcode) {
    const conflict = await prisma.item.findUnique({ where: { barcode: data.barcode } });
    if (conflict) {
      throw new ApiError(409, `An item with barcode "${data.barcode}" already exists`);
    }
  }
  if ("categoryId" in data && data.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) throw new ApiError(400, "Selected category does not exist");
  }
  if ("supplierId" in data && data.supplierId) {
    const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId } });
    if (!supplier) throw new ApiError(400, "Selected supplier does not exist");
  }

  const updateData = {};
  for (const field of [
    "name",
    "sku",
    "barcode",
    "unit",
    "categoryId",
    "supplierId",
    "defaultMinStockLevel",
    "notes",
    "photoUrl",
  ]) {
    if (field in data) updateData[field] = data[field];
  }

  await prisma.item.update({ where: { id }, data: updateData });

  // A changed defaultMinStockLevel can flip low-stock status for any room
  // that doesn't have its own per-room override — recompute all of them.
  if ("defaultMinStockLevel" in updateData) {
    const rows = await prisma.inventoryByRoom.findMany({ where: { itemId: id } });
    for (const row of rows) {
      await refreshAlertsFor(id, row.roomId);
    }
  }

  return getItemById(id);
}

export async function deleteItem(id) {
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) throw new ApiError(404, "Item not found");
  await prisma.item.update({ where: { id }, data: { isActive: false } });

  // Close out any alerts still open for this item — otherwise a low/out-of
  // -stock alert raised before the delete stays "open" forever, keeps
  // showing on the Alerts page and dashboard, and inflates room low-stock
  // counts for an item that no longer exists in the catalog.
  await prisma.alert.updateMany({
    where: { itemId: id, isResolved: false },
    data: { isResolved: true, resolvedAt: new Date() },
  });

  return { id, isActive: false, name: item.name, sku: item.sku };
}
