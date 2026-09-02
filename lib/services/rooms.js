// Room-scoped reads. getRoomInventory is the strictest room boundary in the
// app: it only ever queries InventoryByRoom rows for the one resolved
// roomId — quantities from other rooms never leak in.
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";

// Accepts either a StorageRoom.id (cuid) or its code (e.g. "ROOM1") so both
// `/api/rooms/[roomId]` and a frontend page keyed on room code work. By
// default, deleted (isActive=false) rooms are treated as not-found — pass
// includeInactive: true for the rare internal case that needs to see them.
export async function getRoomByCodeOrId(idOrCode, { includeInactive = false } = {}) {
  if (!idOrCode) throw new ApiError(404, "Storage room not found");
  let room = await prisma.storageRoom.findUnique({ where: { id: idOrCode } });
  if (!room) {
    room = await prisma.storageRoom.findUnique({ where: { code: idOrCode } });
  }
  if (!room || (!room.isActive && !includeInactive)) {
    throw new ApiError(404, "Storage room not found");
  }
  return room;
}

async function getRoomSummary(roomDbId) {
  // Only count rows for items that are still active — a soft-deleted item's
  // leftover InventoryByRoom row (and any alert it left open) must not keep
  // inflating this room's stats forever.
  const inventory = await prisma.inventoryByRoom.findMany({
    where: { roomId: roomDbId, item: { isActive: true } },
  });
  const itemCount = inventory.length;
  const totalUnits = inventory.reduce((sum, row) => sum + row.quantity, 0);
  const lowStockCount = await prisma.alert.count({
    where: { roomId: roomDbId, isResolved: false, item: { isActive: true } },
  });
  return { itemCount, totalUnits, lowStockCount };
}

export async function listRooms() {
  const rooms = await prisma.storageRoom.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  const results = [];
  for (const room of rooms) {
    const summary = await getRoomSummary(room.id);
    results.push({
      id: room.id,
      code: room.code,
      name: room.name,
      location: room.location,
      ...summary,
    });
  }
  return results;
}

export async function getRoomDetail(idOrCode) {
  const room = await getRoomByCodeOrId(idOrCode);
  const summary = await getRoomSummary(room.id);
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    location: room.location,
    description: room.description,
    ...summary,
  };
}

export async function createRoom({ code, name, location, description, sortOrder }) {
  if (!code || !code.trim()) throw new ApiError(400, "Room code is required");
  if (!name || !name.trim()) throw new ApiError(400, "Room name is required");

  const normalizedCode = code.trim().toUpperCase().replace(/\s+/g, "_");

  const existing = await prisma.storageRoom.findUnique({ where: { code: normalizedCode } });
  if (existing) throw new ApiError(409, `A room with code "${normalizedCode}" already exists`);

  let finalSortOrder = sortOrder;
  if (finalSortOrder === undefined || finalSortOrder === null || finalSortOrder === "") {
    const count = await prisma.storageRoom.count();
    finalSortOrder = count + 1;
  } else if (!Number.isInteger(Number(finalSortOrder))) {
    // sortOrder is an Int column — a decimal value (e.g. from a hand-edited
    // request or a stray "1.5" in the form) would otherwise reach Prisma
    // and crash with a raw validation error instead of a clean 400.
    throw new ApiError(400, "Sort order must be a whole number");
  }

  const room = await prisma.storageRoom.create({
    data: {
      code: normalizedCode,
      name: name.trim(),
      location: location || null,
      description: description || null,
      sortOrder: Number(finalSortOrder) || 0,
    },
  });

  return getRoomDetail(room.id);
}

export async function updateRoom(idOrCode, { name, location, description, sortOrder }) {
  const room = await getRoomByCodeOrId(idOrCode);

  const data = {};
  if (name !== undefined) {
    if (!name.trim()) throw new ApiError(400, "Room name cannot be empty");
    data.name = name.trim();
  }
  if (location !== undefined) data.location = location || null;
  if (description !== undefined) data.description = description || null;
  if (sortOrder !== undefined && sortOrder !== null && sortOrder !== "") {
    if (!Number.isInteger(Number(sortOrder))) {
      throw new ApiError(400, "Sort order must be a whole number");
    }
    data.sortOrder = Number(sortOrder);
  }

  await prisma.storageRoom.update({ where: { id: room.id }, data });
  return getRoomDetail(room.id);
}

// Soft delete — ADMIN only (enforced by the route). Refuses to delete a room
// that still holds any stock, so inventory is never silently orphaned; the
// admin has to transfer/zero it out first. Deleted rooms disappear from
// listRooms()/the sidebar but their historical stock movements are kept
// intact for the audit log.
export async function deleteRoom(idOrCode) {
  const room = await getRoomByCodeOrId(idOrCode);

  // The "still holds stock" check and the soft-delete must happen as one
  // atomic, serializable unit — otherwise a concurrent stock addition can
  // land in the gap between the check and the update, letting a room with
  // stock get soft-deleted. Serializable isolation makes Postgres abort
  // this transaction (P2034) if a conflicting concurrent write touched the
  // same rows, instead of silently letting both proceed.
  try {
    await prisma.$transaction(
      async (tx) => {
        // Stock left behind by a soft-deleted item doesn't count against
        // deletion — otherwise a room can become permanently undeletable
        // once any item that once had stock in it gets removed from the
        // catalog.
        const remainingStock = await tx.inventoryByRoom.aggregate({
          where: { roomId: room.id, item: { isActive: true } },
          _sum: { quantity: true },
        });
        const totalUnits = remainingStock._sum.quantity || 0;

        if (totalUnits > 0) {
          throw new ApiError(
            409,
            `Can't delete "${room.name}" — it still holds ${totalUnits} unit(s) of stock. Transfer or remove all stock from this room first.`
          );
        }

        await tx.storageRoom.update({
          where: { id: room.id },
          data: { isActive: false },
        });
      },
      { isolationLevel: "Serializable" }
    );
  } catch (err) {
    if (err?.code === "P2034") {
      throw new ApiError(
        409,
        `Stock in "${room.name}" changed while deleting it — please try again.`
      );
    }
    throw err;
  }

  return { ok: true, id: room.id, code: room.code, name: room.name };
}

export async function getRoomInventory(idOrCode, { search, category, lowStockOnly } = {}) {
  const room = await getRoomByCodeOrId(idOrCode);

  const itemFilter = { isActive: true };
  if (search) {
    itemFilter.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
      { barcode: { contains: search, mode: "insensitive" } },
    ];
  }
  if (category) itemFilter.categoryId = category;

  // Strictly scoped to this room's id — never touches other rooms' rows.
  const rows = await prisma.inventoryByRoom.findMany({
    where: { roomId: room.id, item: itemFilter },
    include: { item: { include: { category: true } } },
    orderBy: { item: { name: "asc" } },
  });

  let results = rows.map((row) => {
    const minStockLevel = row.minStockLevel ?? row.item.defaultMinStockLevel;
    return {
      itemId: row.item.id,
      name: row.item.name,
      sku: row.item.sku,
      barcode: row.item.barcode,
      unit: row.item.unit,
      category: row.item.category ? row.item.category.name : null,
      quantity: row.quantity,
      minStockLevel,
      isLowStock: row.quantity <= minStockLevel,
    };
  });

  if (lowStockOnly) {
    results = results.filter((row) => row.isLowStock);
  }

  return results;
}
