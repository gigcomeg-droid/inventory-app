// Backup snapshots: a full JSON export of the app's data, stored as a row
// in the same database (simplest option with no external storage/API), and
// downloadable so an Admin can save a copy somewhere truly independent of
// this database — a snapshot that only ever lives in the database it's
// backing up isn't a real safety net against that database being lost.
//
// Automatic snapshots are taken every 7 days by Vercel Cron hitting
// /api/backups/run (see vercel.json + that route for the schedule and the
// CRON_SECRET check). Admins can also trigger one on demand from the
// Backups page. Only the most recent MAX_SNAPSHOTS are kept.
import { prisma } from "@/lib/db";

const MAX_SNAPSHOTS = 12; // ~3 months at a weekly cadence

async function buildSnapshotData() {
  // These 8 reads must all see the same point-in-time snapshot of the
  // database, not 8 independent reads racing against concurrent writes —
  // otherwise a stock movement happening mid-backup could show up in
  // `movements` but not yet in `inventory` (or vice versa), producing a
  // snapshot that's internally inconsistent despite looking like a normal,
  // trustworthy backup. RepeatableRead isolation gives every statement in
  // this transaction the same consistent snapshot as of its start.
  const [rooms, items, inventory, movements, alerts, users, categories, suppliers] =
    await prisma.$transaction(
      [
        prisma.storageRoom.findMany(),
        prisma.item.findMany(),
        prisma.inventoryByRoom.findMany(),
        prisma.stockMovement.findMany(),
        prisma.alert.findMany(),
        // Never include passwordHash in a backup export.
        prisma.user.findMany({
          select: {
            id: true,
            username: true,
            name: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        }),
        prisma.category.findMany(),
        prisma.supplier.findMany(),
      ],
      { isolationLevel: "RepeatableRead" }
    );

  return {
    exportedAt: new Date().toISOString(),
    rooms,
    items,
    inventory,
    movements,
    alerts,
    users,
    categories,
    suppliers,
  };
}

export async function createBackupSnapshot({ triggeredBy } = {}) {
  const data = await buildSnapshotData();
  const json = JSON.stringify(data);
  const summary = `${data.rooms.length} room(s), ${data.items.length} item(s), ${data.inventory.length} stock row(s), ${data.movements.length} movement(s), ${data.alerts.length} alert(s), ${data.users.length} user(s)`;

  const snapshot = await prisma.backupSnapshot.create({
    data: {
      triggeredBy: triggeredBy || "Automatic (scheduled)",
      sizeBytes: Buffer.byteLength(json, "utf-8"),
      summary,
      data: json,
    },
  });

  // Prune anything beyond the most recent MAX_SNAPSHOTS.
  const old = await prisma.backupSnapshot.findMany({
    orderBy: { createdAt: "desc" },
    skip: MAX_SNAPSHOTS,
    select: { id: true },
  });
  if (old.length > 0) {
    await prisma.backupSnapshot.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  }

  return {
    id: snapshot.id,
    createdAt: snapshot.createdAt,
    sizeBytes: snapshot.sizeBytes,
    summary: snapshot.summary,
    triggeredBy: snapshot.triggeredBy,
  };
}

export async function listBackupSnapshots() {
  return prisma.backupSnapshot.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, sizeBytes: true, summary: true, triggeredBy: true },
  });
}

// Full row including the JSON payload — only used by the download route.
export async function getBackupSnapshot(id) {
  return prisma.backupSnapshot.findUnique({ where: { id } });
}
