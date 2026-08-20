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

// itemName/roomCode on each return value below are purely for callers that
// want a human-readable audit-log message (see app/api/stock/*/route.js) —
// they're additive fields, safe alongside the existing InventoryByRoom shape.

export async function addStock({ itemId, roomId, quantity, note, userId }) {
  assertPositiveInt(quantity, "quantity");

  let itemName, roomCode;

  await prisma.$transaction(async (tx) => {
    const item = await assertItemActive(tx, itemId);
    const room = await assertRoomExists(tx, roomId);
    itemName = item.name;
    roomCode = room.code;

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
  const row = await getRoomInventoryRow(itemId, roomId);
  return { ...row, itemName, roomCode };
}

export async function removeStock({ itemId, roomId, quantity, note, userId }) {
  assertPositiveInt(quantity, "quantity");

  let itemName, roomCode;

  await prisma.$transaction(async (tx) => {
    const item = await assertItemActive(tx, itemId);
    const room = await assertRoomExists(tx, roomId);
    itemName = item.name;
    roomCode = room.code;

    // Atomic compare-and-decrement rather than read-then-write: the
    // quantity >= quantity check happens inside the same UPDATE statement,
    // under the row lock Postgres takes to apply it. Two concurrent
    // removeStock/transferStock calls against the same row can no longer
    // both read a stale "current" value and both pass the guard — the
    // second one's updateMany simply matches 0 rows once the first has
    // committed its decrement, instead of racing past this check and
    // pushing the quantity negative.
    const result = await tx.inventoryByRoom.updateMany({
      where: { itemId, roomId, quantity: { gte: quantity } },
      data: { quantity: { decrement: quantity } },
    });

    if (result.count === 0) {
      const row = await tx.inventoryByRoom.findUnique({
        where: { itemId_roomId: { itemId, roomId } },
      });
      const current = row?.quantity ?? 0;
      throw new ApiError(
        409,
        `Insufficient stock: only ${current} available in this room`
      );
    }

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
  const row = await getRoomInventoryRow(itemId, roomId);
  return { ...row, itemName, roomCode };
}

export async function adjustStock({ itemId, roomId, newQuantity, note, userId }) {
  if (!Number.isInteger(newQuantity) || newQuantity < 0) {
    throw new ApiError(400, "newQuantity must be a non-negative integer");
  }

  let itemName, roomCode, delta;

  await prisma.$transaction(async (tx) => {
    const item = await assertItemActive(tx, itemId);
    const room = await assertRoomExists(tx, roomId);
    itemName = item.name;
    roomCode = room.code;

    const row = await tx.inventoryByRoom.findUnique({
      where: { itemId_roomId: { itemId, roomId } },
    });
    const current = row?.quantity ?? 0;
    delta = newQuantity - current;

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
  const row = await getRoomInventoryRow(itemId, roomId);
  return { ...row, itemName, roomCode, delta };
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

  let itemName, fromRoomCode, toRoomCode;

  await prisma.$transaction(async (tx) => {
    const item = await assertItemActive(tx, itemId);
    const fromRoom = await assertRoomExists(tx, fromRoomId);
    const toRoom = await assertRoomExists(tx, toRoomId);
    itemName = item.name;
    fromRoomCode = fromRoom.code;
    toRoomCode = toRoom.code;

    // Atomic compare-and-decrement — see removeStock() above for why this
    // must be a single conditional UPDATE rather than a separate read then
    // write (prevents two concurrent transfers/removals from the same room
    // both passing a stale "current stock" check and over-drawing it).
    const fromResult = await tx.inventoryByRoom.updateMany({
      where: { itemId, roomId: fromRoomId, quantity: { gte: quantity } },
      data: { quantity: { decrement: quantity } },
    });

    if (fromResult.count === 0) {
      const fromRow = await tx.inventoryByRoom.findUnique({
        where: { itemId_roomId: { itemId, roomId: fromRoomId } },
      });
      const current = fromRow?.quantity ?? 0;
      throw new ApiError(
        409,
        `Insufficient stock in source room: only ${current} available`
      );
    }

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
    itemName,
    fromRoomCode,
    toRoomCode,
    from: await getRoomInventoryRow(itemId, fromRoomId),
    to: await getRoomInventoryRow(itemId, toRoomId),
  };
}
