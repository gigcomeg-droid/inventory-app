import { NextResponse } from "next/server";
import { createBackupSnapshot } from "@/lib/services/backups";
import { logAction } from "@/lib/services/auditLog";

// Hit automatically by Vercel Cron every 7 days (see vercel.json's
// `crons` entry). NOT session-protected — cron requests don't carry the
// app's login cookie — instead it's protected by a shared secret. Vercel
// sends `Authorization: Bearer <CRON_SECRET>` automatically for scheduled
// invocations once the CRON_SECRET env var is set on the project; any
// request missing/mismatching that header is rejected. If CRON_SECRET
// isn't configured at all, this route refuses every request rather than
// running unauthenticated.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await createBackupSnapshot({ triggeredBy: "Automatic (scheduled)" });

  await logAction({
    action: "BACKUP_CREATE",
    entityType: "BackupSnapshot",
    entityId: snapshot.id,
    details: `Automatic weekly backup — ${snapshot.summary}`,
  });

  return NextResponse.json({ ok: true, snapshot });
}

// Vercel Cron sends GET requests; POST is accepted too in case that ever
// changes, or for manual testing with a tool that only does POST.
export const POST = GET;
