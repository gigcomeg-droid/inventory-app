-- CreateTable
CREATE TABLE "backup_snapshots" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triggeredBy" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "data" TEXT NOT NULL,

    CONSTRAINT "backup_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backup_snapshots_createdAt_idx" ON "backup_snapshots"("createdAt");
