import { NextResponse } from "next/server";
import { requireRole, errorResponse, ApiError } from "@/lib/auth";
import { getBackupSnapshot } from "@/lib/services/backups";
import { logAction } from "@/lib/services/auditLog";

// Downloads one snapshot's full JSON export — ADMIN only. This is the
// actual safety net: save this file somewhere outside this database
// (your own computer, a cloud drive, wherever) so a real backup exists
// independent of the database it was taken from.
export async function GET(request, { params }) {
  try {
    const session = await requireRole(request, ["ADMIN"]);

    const snapshot = await getBackupSnapshot(params.id);
    if (!snapshot) throw new ApiError(404, "Backup snapshot not found");

    await logAction({
      userId: session.sub,
      action: "BACKUP_DOWNLOAD",
      entityType: "BackupSnapshot",
      entityId: snapshot.id,
      details: `Downloaded backup from ${snapshot.createdAt.toISOString()}`,
    });

    const filename = `inventory-backup-${snapshot.createdAt.toISOString().slice(0, 10)}.json`;

    return new NextResponse(snapshot.data, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
