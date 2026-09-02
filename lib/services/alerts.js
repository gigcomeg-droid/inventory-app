// Low-stock / out-of-stock alert bookkeeping. This is the ONLY place that
// creates/resolves Alert rows — every stock-mutating route calls
// refreshAlertsFor(itemId, roomId) after it commits, so the alerts table is
// always a live reflection of current per-room quantities vs. the
// effective min stock level (per-room override, else item.defaultMinStockLevel).
import { prisma } from "@/lib/db";

export async function refreshAlertsFor(itemId, roomId) {
  const [item, invRow] = await Promise.all([
    prisma.item.findUnique({ where: { id: itemId } }),
    prisma.inventoryByRoom.findUnique({
      where: { itemId_roomId: { itemId, roomId } },
    }),
  ]);

  if (!item) return null;

  const quantity = invRow?.quantity ?? 0;
  const minStockLevel = invRow?.minStockLevel ?? item.defaultMinStockLevel ?? 0;
  const isLow = quantity <= minStockLevel;

  const existingOpenAlert = await prisma.alert.findFirst({
    where: { itemId, roomId, isResolved: false },
    orderBy: { createdAt: "desc" },
  });

  if (!isLow) {
    if (existingOpenAlert) {
      return prisma.alert.update({
        where: { id: existingOpenAlert.id },
        data: { isResolved: true, resolvedAt: new Date() },
      });
    }
    return null;
  }

  const type = quantity <= 0 ? "OUT_OF_STOCK" : "LOW_STOCK";
  const message =
    type === "OUT_OF_STOCK"
      ? `${item.name} is out of stock`
      : `${item.name} is low on stock (${quantity} ${item.unit} left, min ${minStockLevel})`;

  if (existingOpenAlert) {
    if (existingOpenAlert.type !== type || existingOpenAlert.message !== message) {
      return prisma.alert.update({
        where: { id: existingOpenAlert.id },
        data: { type, message },
      });
    }
    return existingOpenAlert;
  }

  return prisma.alert.create({
    data: { itemId, roomId, type, message },
  });
}

export async function listAlerts({ roomId, resolved } = {}) {
  // A soft-deleted item can leave a stale open alert behind (deleting an
  // item doesn't retroactively resolve alerts raised before it was
  // deleted) — never surface those, they refer to stock that no longer
  // exists in the active catalog.
  const where = { item: { isActive: true } };
  if (roomId) where.roomId = roomId;
  if (resolved === true || resolved === false) where.isResolved = resolved;

  const alerts = await prisma.alert.findMany({
    where,
    include: {
      item: { select: { id: true, name: true, sku: true, unit: true } },
      room: { select: { id: true, code: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return alerts;
}

export async function resolveAlert(id) {
  const alert = await prisma.alert.findUnique({ where: { id } });
  if (!alert) return null;
  return prisma.alert.update({
    where: { id },
    data: { isResolved: true, resolvedAt: new Date() },
  });
}
