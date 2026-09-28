-- AlterTable: add the "movement actually happened on" date, separate from
-- createdAt (when the row was logged). Nullable at first so we can backfill
-- existing rows before making it required.
ALTER TABLE "stock_movements" ADD COLUMN "occurredAt" TIMESTAMP(3);

-- Backfill existing movements: their occurredAt is their original createdAt,
-- so historical entries don't all jump to "now" once the column is required.
UPDATE "stock_movements" SET "occurredAt" = "createdAt" WHERE "occurredAt" IS NULL;

-- Now that every row has a value, make it required and default new rows to
-- "now" (same behavior as createdAt) unless the caller supplies one.
ALTER TABLE "stock_movements" ALTER COLUMN "occurredAt" SET NOT NULL;
ALTER TABLE "stock_movements" ALTER COLUMN "occurredAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "stock_movements_occurredAt_idx" ON "stock_movements"("occurredAt");
