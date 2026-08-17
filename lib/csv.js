// CSV/XLSX import & export, built on the `xlsx` (SheetJS) package which
// reads and writes both formats. No external network calls.
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
import { refreshAlertsFor } from "@/lib/services/alerts";

function toWorkbookBuffer(rows, sheetName, format) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));

  if (format === "xlsx") {
    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  }
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  return Buffer.from(csv, "utf-8");
}

async function resolveRoom(idOrCode) {
  const room =
    (await prisma.storageRoom.findUnique({ where: { id: idOrCode } })) ||
    (await prisma.storageRoom.findUnique({ where: { code: idOrCode } }));
  if (!room) throw new ApiError(404, "Storage room not found");
  return room;
}

// -- Export ------------------------------------------------------------

export async function buildItemsExport(format) {
  const items = await prisma.item.findMany({
    where: { isActive: true },
    include: { category: true, supplier: true, inventory: { include: { room: true } } },
    orderBy: { name: "asc" },
  });

  const rows = items.map((item) => {
    const totalQuantity = item.inventory.reduce((sum, r) => sum + r.quantity, 0);
    const perRoom = item.inventory
      .slice()
      .sort((a, b) => a.room.code.localeCompare(b.room.code))
      .map((r) => `${r.room.code}:${r.quantity}`)
      .join(" ");

    return {
      name: item.name,
      sku: item.sku,
      barcode: item.barcode || "",
      category: item.category?.name || "",
      supplier: item.supplier?.name || "",
      unit: item.unit,
      defaultMinStockLevel: item.defaultMinStockLevel,
      totalQuantity,
      perRoom,
      notes: item.notes || "",
    };
  });

  return toWorkbookBuffer(rows, "Items", format);
}

export async function buildMovementsExport(format) {
  const movements = await prisma.stockMovement.findMany({
    include: { item: true, fromRoom: true, toRoom: true, user: true },
    orderBy: { createdAt: "desc" },
  });

  const rows = movements.map((m) => ({
    date: m.createdAt.toISOString(),
    type: m.type,
    item: m.item.name,
    sku: m.item.sku,
    quantity: m.quantity,
    fromRoom: m.fromRoom?.code || "",
    toRoom: m.toRoom?.code || "",
    user: m.user?.name || "",
    note: m.note || "",
  }));

  return toWorkbookBuffer(rows, "Movements", format);
}

// Room-scoped export — only rows for that room's InventoryByRoom, never
// mixed with other rooms.
export async function buildRoomExport(roomIdOrCode, format) {
  const room = await resolveRoom(roomIdOrCode);

  const rows = await prisma.inventoryByRoom.findMany({
    where: { roomId: room.id },
    include: { item: { include: { category: true } } },
    orderBy: { item: { name: "asc" } },
  });

  const data = rows.map((row) => {
    const minStockLevel = row.minStockLevel ?? row.item.defaultMinStockLevel;
    return {
      name: row.item.name,
      sku: row.item.sku,
      barcode: row.item.barcode || "",
      category: row.item.category?.name || "",
      unit: row.item.unit,
      quantity: row.quantity,
      minStockLevel,
      isLowStock: row.quantity <= minStockLevel,
    };
  });

  return { buffer: toWorkbookBuffer(data, room.code, format), room };
}

export function contentTypeFor(format) {
  return format === "xlsx"
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "text/csv";
}

export function filenameFor(type, format, roomCode) {
  const ext = format === "xlsx" ? "xlsx" : "csv";
  if (type === "room" && roomCode) {
    return `inventory-${roomCode}.${ext}`;
  }
  return `${type}.${ext}`;
}

// -- Import --------------------------------------------------------------

// Expected columns: name, sku, barcode, category, unit, quantity,
// minStockLevel, supplier, notes. Upserts Item by sku; `quantity` (if
// present) sets that item's InventoryByRoom row for the given roomId only.
export async function importInventory({ buffer, roomId, userId }) {
  const room = await resolveRoom(roomId);

  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch (err) {
    throw new ApiError(400, "Could not parse the uploaded file as CSV or XLSX");
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const result = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rawRows.length; i++) {
    const rowNum = i + 2; // header occupies row 1
    const raw = rawRows[i];
    const name = String(raw.name ?? "").trim();
    const sku = String(raw.sku ?? "").trim();

    if (!name || !sku) {
      result.skipped++;
      result.errors.push(`Row ${rowNum}: missing required "name" or "sku"`);
      continue;
    }

    try {
      let categoryId;
      const categoryName = String(raw.category ?? "").trim();
      if (categoryName) {
        const category = await prisma.category.upsert({
          where: { name: categoryName },
          create: { name: categoryName },
          update: {},
        });
        categoryId = category.id;
      }

      let supplierId;
      const supplierName = String(raw.supplier ?? "").trim();
      if (supplierName) {
        let supplier = await prisma.supplier.findFirst({ where: { name: supplierName } });
        if (!supplier) {
          supplier = await prisma.supplier.create({ data: { name: supplierName } });
        }
        supplierId = supplier.id;
      }

      const barcode = String(raw.barcode ?? "").trim() || undefined;
      const unit = String(raw.unit ?? "").trim() || "pcs";
      const notes = String(raw.notes ?? "").trim() || undefined;

      const minStockLevelRaw = raw.minStockLevel;
      const minStockLevel =
        minStockLevelRaw !== "" && minStockLevelRaw != null && !Number.isNaN(parseInt(minStockLevelRaw, 10))
          ? parseInt(minStockLevelRaw, 10)
          : undefined;

      const quantityRaw = raw.quantity;
      const quantity =
        quantityRaw !== "" && quantityRaw != null && !Number.isNaN(parseInt(quantityRaw, 10))
          ? parseInt(quantityRaw, 10)
          : undefined;

      const existingItem = await prisma.item.findUnique({ where: { sku } });

      let item;
      if (existingItem) {
        item = await prisma.item.update({
          where: { sku },
          data: {
            name,
            barcode: barcode ?? existingItem.barcode,
            unit,
            categoryId: categoryId ?? existingItem.categoryId,
            supplierId: supplierId ?? existingItem.supplierId,
            defaultMinStockLevel:
              minStockLevel !== undefined ? minStockLevel : existingItem.defaultMinStockLevel,
            notes: notes ?? existingItem.notes,
          },
        });
        result.updated++;
      } else {
        item = await prisma.item.create({
          data: {
            name,
            sku,
            barcode: barcode ?? null,
            unit,
            categoryId: categoryId ?? null,
            supplierId: supplierId ?? null,
            defaultMinStockLevel: minStockLevel ?? 0,
            notes: notes ?? null,
          },
        });
        result.created++;
      }

      if (quantity !== undefined && quantity >= 0) {
        const invRow = await prisma.inventoryByRoom.findUnique({
          where: { itemId_roomId: { itemId: item.id, roomId: room.id } },
        });
        const previousQuantity = invRow?.quantity ?? 0;

        await prisma.inventoryByRoom.upsert({
          where: { itemId_roomId: { itemId: item.id, roomId: room.id } },
          create: { itemId: item.id, roomId: room.id, quantity, minStockLevel: minStockLevel ?? null },
          update: {
            quantity,
            ...(minStockLevel !== undefined ? { minStockLevel } : {}),
          },
        });

        if (quantity !== previousQuantity) {
          await prisma.stockMovement.create({
            data: {
              type: "ADJUST",
              itemId: item.id,
              quantity: Math.abs(quantity - previousQuantity),
              toRoomId: room.id,
              note: `Imported from file (set to ${quantity})`,
              userId: userId || null,
            },
          });
        }

        await refreshAlertsFor(item.id, room.id);
      }
    } catch (err) {
      result.skipped++;
      result.errors.push(`Row ${rowNum} (sku "${sku}"): ${err.message}`);
    }
  }

  return result;
}
