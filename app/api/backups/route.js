import { NextResponse } from "next/server";
import { requireRole, errorResponse, getCurrentUser } from "@/lib/auth";
import { listBackupSnapshots, createBackupSnapshot } from "@/lib/services/backups";
import { logAction } from "@/lib/services/auditLog";

// List existing snapshots — ADMIN only.
export async function GET(request) {
  try {
    const session = await requireRole(request, ["ADMIN"]);

    const snapshots = await listBackupSnapshots();
    return NextResponse.json(snapshots);
  } catch (err) {
    return errorResponse(err);
  }
}

// Trigger a backup right now — ADMIN only. The automatic weekly backup
// hits /api/backups/run instead (see that route + vercel.json).
export async function POST(request) {
  try {
    const session = await requireRole(request, ["ADMIN"]);

    const currentUser = await getCurrentUser(request);
    const triggeredBy = currentUser ? `${currentUser.name} (${currentUser.username})` : undefined;

    const snapshot = await createBackupSnapshot({ triggeredBy });

    await logAction({
      userId: session.sub,
      action: "BACKUP_CREATE",
      entityType: "BackupSnapshot",
      entityId: snapshot.id,
      details: `Created a manual backup — ${snapshot.summary}`,
    });

    return NextResponse.json(snapshot, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
