// Cross-room movement history log (this is an explicitly cross-room view —
// filtering by roomId matches movements where that room was either the
// source or destination, it does not sum quantities across rooms).
import { prisma } from "@/lib/db";

export async function listMovements({ itemId, roomId, type, limit, before } = {}) {
  const where = {};
  if (itemId) where.itemId = itemId;
  if (type) where.type = type;
  if (roomId) {
    where.OR = [{ fromRoomId: roomId }, { toRoomId: roomId }];
  }
  if (before) {
    const beforeDate = new Date(before);
    if (!Number.isNaN(beforeDate.getTime())) {
      where.createdAt = { lt: beforeDate };
    }
  }

  const take = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

  const movements = await prisma.stockMovement.findMany({
    where,
    include: {
      item: { select: { id: true, name: true, sku: true, unit: true } },
      fromRoom: { select: { id: true, code: true, name: true } },
      toRoom: { select: { id: true, code: true, name: true } },
      user: { select: { id: true, name: true, username: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  return movements;
}
