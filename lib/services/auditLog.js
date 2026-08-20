// Audit trail service. This is the "who did what" record admins can review:
// every route that creates/edits/deletes something, or moves stock, calls
// logAction() after it succeeds. Writing an entry NEVER throws — a logging
// hiccup must never break the real action a user was trying to perform.
import { prisma } from "@/lib/db";

// Kept as a plain list (not a DB enum — see schema.prisma's note on Role/
// MovementType) so the audit log page can offer a filter dropdown without
// a separate query.
export const AUDIT_ACTIONS = [
  "LOGIN",
  "LOGIN_FAILED",
  "LOGOUT",
  "ITEM_CREATE",
  "ITEM_UPDATE",
  "ITEM_DELETE",
  "STOCK_ADD",
  "STOCK_REMOVE",
  "STOCK_ADJUST",
  "STOCK_TRANSFER",
  "ROOM_CREATE",
  "ROOM_UPDATE",
  "ROOM_DELETE",
  "USER_CREATE",
  "USER_UPDATE",
  "ALERT_RESOLVE",
  "IMPORT_CSV",
  "BACKUP_CREATE",
  "BACKUP_DOWNLOAD",
  "CATEGORY_CREATE",
  "CATEGORY_UPDATE",
  "CATEGORY_DELETE",
  "SUPPLIER_CREATE",
  "SUPPLIER_UPDATE",
  "SUPPLIER_DELETE",
];

export async function logAction({ userId, action, entityType, entityId, details }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action,
        entityType: entityType || null,
        entityId: entityId || null,
        details: details || null,
      },
    });
  } catch (err) {
    // Deliberately swallowed — see module note above.
    console.error("Failed to write audit log entry:", err);
  }
}

export async function listAuditLog({ userId, action, from, to, page = 1, pageSize = 50 } = {}) {
  const where = {};
  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (from || to) {
    where.createdAt = {};
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) where.createdAt.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) where.createdAt.lte = d;
    }
    if (Object.keys(where.createdAt).length === 0) delete where.createdAt;
  }

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safePageSize = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 50));

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, username: true } } },
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    }),
  ]);

  const entries = rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    details: row.details,
    createdAt: row.createdAt,
    user: row.user ? { id: row.user.id, name: row.user.name, username: row.user.username } : null,
  }));

  return { total, page: safePage, pageSize: safePageSize, entries };
}

// For the filter dropdown — only users who actually have log entries,
// rather than every user in the system.
export async function listAuditLogUsers() {
  const rows = await prisma.auditLog.findMany({
    where: { userId: { not: null } },
    distinct: ["userId"],
    select: { user: { select: { id: true, name: true, username: true } } },
  });
  return rows
    .map((r) => r.user)
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}
