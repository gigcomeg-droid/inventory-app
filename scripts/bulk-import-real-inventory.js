// One-time bulk import: replaces the placeholder demo data (seeded rooms
// ROOM1-ROOM4 and their 21 sample items) with the real inventory from the
// user's spreadsheet (4 sheets -> 4 new rooms: Ground Floor, 2nd Floor,
// Catering, PR), reading scripts/bulk-import-data.json for the item list.
//
// SAFE TO RUN EXACTLY ONCE. Run it from the project folder with:
//   node scripts/bulk-import-real-inventory.js
//
// What it does, in order:
//   1. Deletes the 21 known demo items (by SKU) — this cascades and removes
//      their stock rows, movement history and alerts automatically.
//   2. Deletes the 4 demo rooms (ROOM1-ROOM4), now empty.
//   3. Creates the 4 real rooms (Ground Floor, 2nd Floor, Catering, PR).
//   4. Creates every item from the spreadsheet with its SKU, name, category
//      (auto-created if new), unit, and notes (original description/color),
//      and sets its starting quantity in its room.
//
// Nothing here touches low-stock thresholds — every imported item starts
// with a min stock level of 0 (no alerts) since the spreadsheet didn't
// specify real reorder points. Set those per item afterwards in the app
// (Edit Item -> Minimum stock level) for the ones you want alerts on.
const fs = require("fs");
const path = require("path");

// Minimal built-in .env loader (no external "dotenv" dependency needed) —
// running this as a plain `node scripts/...` script, rather than through
// Next.js or the `prisma` CLI, means DATABASE_URL/DIRECT_URL wouldn't
// otherwise be picked up from the project's .env file.
function loadEnvFile(filename) {
  const envPath = path.join(__dirname, "..", filename);
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvFile(".env");
loadEnvFile(".env.local");

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const DEMO_ITEM_SKUS = [
  "PT-001", "CL-002", "GL-003", "SG-004", "FA-005", "PP-006", "PN-007",
  "SN-008", "ST-009", "TN-010", "USB-011", "HD-012", "WM-013", "EC-014",
  "DR-015", "SC-016", "DT-017", "CF-018", "WT-019", "CP-020",
];
const DEMO_ROOM_CODES = ["ROOM1", "ROOM2", "ROOM3", "ROOM4"];

async function main() {
  const dataPath = path.join(__dirname, "bulk-import-data.json");
  const { rooms, items } = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

  console.log(`Loaded ${items.length} items across ${rooms.length} rooms from ${dataPath}`);

  // -- Step 1: remove demo items (cascades to their stock/movements/alerts) --
  const deletedItems = await prisma.item.deleteMany({
    where: { sku: { in: DEMO_ITEM_SKUS } },
  });
  console.log(`Deleted ${deletedItems.count} demo items.`);

  // -- Step 2: remove demo rooms (now holding no active items) --
  const deletedRooms = await prisma.storageRoom.deleteMany({
    where: { code: { in: DEMO_ROOM_CODES } },
  });
  console.log(`Deleted ${deletedRooms.count} demo rooms.`);

  // -- Step 3: create the real rooms --
  const roomIdByCode = {};
  for (const r of rooms) {
    const existing = await prisma.storageRoom.findUnique({ where: { code: r.code } });
    if (existing) {
      console.log(`Room ${r.code} already exists — reusing it.`);
      roomIdByCode[r.code] = existing.id;
      continue;
    }
    const created = await prisma.storageRoom.create({
      data: { code: r.code, name: r.name, sortOrder: r.sortOrder },
    });
    roomIdByCode[r.code] = created.id;
    console.log(`Created room ${r.code} (${r.name}).`);
  }

  // -- Step 4: create items + their stock in each room --
  const categoryIdByName = {};
  let created = 0;
  let skippedExisting = 0;

  for (const it of items) {
    const existingItem = await prisma.item.findUnique({ where: { sku: it.sku } });
    if (existingItem) {
      console.warn(`Skipping "${it.name}" — SKU ${it.sku} already exists in the database.`);
      skippedExisting++;
      continue;
    }

    let categoryId;
    if (it.category) {
      if (!categoryIdByName[it.category]) {
        const cat = await prisma.category.upsert({
          where: { name: it.category },
          create: { name: it.category },
          update: {},
        });
        categoryIdByName[it.category] = cat.id;
      }
      categoryId = categoryIdByName[it.category];
    }

    const item = await prisma.item.create({
      data: {
        name: it.name,
        sku: it.sku,
        unit: it.unit,
        notes: it.notes || null,
        categoryId: categoryId || null,
        defaultMinStockLevel: 0,
      },
    });

    const roomId = roomIdByCode[it.roomCode];
    await prisma.inventoryByRoom.create({
      data: { itemId: item.id, roomId, quantity: it.quantity },
    });

    created++;
    if (created % 50 === 0) console.log(`...${created} items imported so far`);
  }

  await prisma.auditLog.create({
    data: {
      action: "IMPORT_CSV",
      entityType: "StorageRoom",
      details: `Bulk import script: replaced demo data with ${created} real items across ${rooms.length} rooms (${skippedExisting} skipped as already existing).`,
    },
  });

  console.log(`\nDone. Created ${created} items. Skipped ${skippedExisting} (SKU already existed).`);
}

main()
  .catch((err) => {
    console.error("Import failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
