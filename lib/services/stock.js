// Stock mutation operations: add / remove / adjust / transfer.
// IMPORTANT: every operation here is scoped to a single roomId (or, for
// transfer, exactly two explicit rooms) — quantities are never summed or
// mixed across rooms. Transfer is atomic via prisma.$transaction.
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
import { refreshAlertsFor } from "@/lib/services/alerts";

async function assertItemActive(tx, itemId) {
  const item = await tx.item.findUnique({ where: { id: itemId } });
  if (!item || !item.isActive) {
    throw new ApiError(404, "Item not found");
  }
  return item;
}

async function assertRoomExists(tx, roomId) {
  const room = await tx.storageRoom.findUnique({ where: { id: roomId } });
  if (!room) {
    throw new ApiError(404, "Storage room not found");
  }
  return room;
}

function assertPositiveInt(value, field) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ApiError(400, `${field} must be a positive integer`);
  }
}

async function getRoomInventoryRow(itemId, roomId) {
  return prisma.inventoryByRoom.findUnique({
    where: { itemId_roomId: { itemId, roomId } },
  });
}

export async function addStock({ itemId, roomId, quantity, note, userId }) {
  assertPositiveInt(quantity, "quantity");

  await prisma.$transaction(async (tx) => {
    await assertItemActive(tx, itemId);
    await assertRoomExists(tx, roomId);

    await tx.inventoryByRoom.upsert({
      where: { itemId_roomId: { itemId, roomId } },
      create: { itemId, roomId, quantity },
      update: { quantity: { increment: quantity } },
    });

    await tx.stockMovement.create({
      data: {
        type: "ADD",
        itemId,
        quantity,
        toRoomId: roomId,
        note: note || null,
        userId: userId || null,
      },
    });
  });

  await refreshAlertsFor(itemId, roomId);
  return getRoomInventoryRow(itemId, roomId);
}

export async function removeStock({ itemId, roomId, quantity, note, userId }) {
  assertPositiveInt(quantity, "quantity");

  await prisma.$transaction(async (tx) => {
    await assertItemActive(tx, itemId);
    await assertRoomExists(tx, roomId);

    const row = await tx.inventoryByRoom.findUnique({
      where: { itemId_roomId: { itemId, roomId } },
    });
    const current = row?.quantity ?? 0;
    if (current < quantity) {
      throw new ApiError(
        409,
        `Insufficient stock: only ${current} available in this room`
      );
    }

    await tx.inventoryByRoom.update({
      where: { itemId_roomId: { itemId, roomId } },
      data: { quantity: { decrement: quantity } },
    });

    await tx.stockMovement.create({
      data: {
        type: "REMOVE",
        itemId,
        quantity,
        fromRoomId: roomId,
        note: note || null,
        userId: userId || null,
      },
    });
  });

  await refreshAlertsFor(itemId, roomId);
  return getRoomInventoryRow(itemId, roomId);
}

export async function adjustStock({ itemId, roomId, newQuantity, note, userId }) {
  if (!Number.isInteger(newQuantity) || newQuantity < 0) {
    throw new ApiError(400, "newQuantity must be a non-negative integer");
  }

  await prisma.$transaction(async (tx) => {
    await assertItemActive(tx, itemId);
    await assertRoomExists(tx, roomId);

    const row = await tx.inventoryByRoom.findUnique({
      where: { itemId_roomId: { itemId, roomId } },
    });
    const current = row?.quantity ?? 0;
    const delta = newQuantity - current;

    await tx.inventoryByRoom.upsert({
      where: { itemId_roomId: { itemId, roomId } },
      create: { itemId, roomId, quantity: newQuantity },
      update: { quantity: newQuantity },
    });

    const sign = delta >= 0 ? "+" : "";
    const deltaNote = `Adjusted by ${sign}${delta}${note ? ` — ${note}` : ""}`;

    await tx.stockMovement.create({
      data: {
        type: "ADJUST",
        itemId,
        quantity: Math.abs(delta),
        toRoomId: roomId,
        note: deltaNote,
        userId: userId || null,
      },
    });
  });

  await refreshAlertsFor(itemId, roomId);
  return getRoomInventoryRow(itemId, roomId);
}

export async function transferStock({
  itemId,
  fromRoomId,
  toRoomId,
  quantity,
  note,
  userId,
}) {
  assertPositiveInt(quantity, "quantity");

  if (!fromRoomId || !toRoomId) {
    throw new ApiError(400, "fromRoomId and toRoomId are required");
  }
  if (fromRoomId === toRoomId) {
    throw new ApiError(400, "Source and destination rooms must be different");
  }

  await prisma.$transaction(async (tx) => {
    await assertItemActive(tx, itemId);
    await assertRoomExists(tx, fromRoomId);
    await assertRoomExists(tx, toRoomId);

    const fromRow = await tx.inventoryByRoom.findUnique({
      where: { itemId_roomId: { itemId, roomId: fromRoomId } },
    });
    const current = fromRow?.quantity ?? 0;
    if (current < quantity) {
      throw new ApiError(
        409,
        `Insufficient stock in source room: only ${current} available`
      );
    }

    await tx.inventoryByRoom.update({
      where: { itemId_roomId: { itemId, roomId: fromRoomId } },
      data: { quantity: { decrement: quantity } },
    });

    await tx.inventoryByRoom.upsert({
      where: { itemId_roomId: { itemId, roomId: toRoomId } },
      create: { itemId, roomId: toRoomId, quantity },
      update: { quantity: { increment: quantity } },
    });

    await tx.stockMovement.create({
      data: {
        type: "TRANSFER",
        itemId,
        quantity,
        fromRoomId,
        toRoomId,
        note: note || null,
        userId: userId || null,
      },
    });
  });

  await Promise.all([
    refreshAlertsFor(itemId, fromRoomId),
    refreshAlertsFor(itemId, toRoomId),
  ]);

  return {
    from: await getRoomInventoryRow(itemId, fromRoomId),
    to: await getRoomInventoryRow(itemId, toRoomId),
  };
}
