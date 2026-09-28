// Syncs the live database to match Marketing_Inventory.xlsx (the "final
// data" file). Uses your project's existing Prisma client + .env, so it
// needs no new setup — just `node scripts/sync-marketing-inventory.js`.
//
// SAFE BY DEFAULT: running it with no flags only PRINTS a full plan (what
// would be created / updated / removed) and writes the same plan to
// sync-report.json. NOTHING in the database is touched until you re-run it
// with --apply.
//
//   node scripts/sync-marketing-inventory.js            (dry run, safe)
//   node scripts/sync-marketing-inventory.js --apply     (actually writes)
//
// What it does, per the 4 room sheets (PR, 2nd Floor, Catering, Ground
// Floor) in marketing-inventory-data.json:
//   - Matches each row to an existing item first by exact name (within the
//     same room), then by SKU-code-suffix (e.g. an existing SKU ending in
//     "-101" matches code "101") — this catches items whose name changed
//     but whose original code didn't.
//   - Matched items: updates name/category/quantity if different.
//   - Unmatched rows: creates a new item + starting stock in that room.
//   - Any item currently active with stock in one of these 4 rooms that
//     ISN'T claimed by any row in the new file gets soft-deleted (isActive
//     = false), per your instruction to treat this file as the complete,
//     exact source of truth. Soft-delete only — nothing is hard-deleted,
//     and it also resolves any open alerts for that item (same behavior as
//     deleting an item from the app's Items page).
//   - "New Year" and "2027 send email" sheets are intentionally excluded —
//     those aren't inventory data (see the report's `excludedSheets` note).

const path = require("path");
const fs = require("fs");

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const DATA_PATH = path.join(__dirname, "marketing-inventory-data.json");
const REPORT_PATH = path.join(__dirname, "..", "sync-report.json");

// Sheet name -> candidate strings to match against StorageRoom.name/code
// (case-insensitive, whitespace-insensitive contains-match either way).
const ROOM_MATCH_HINTS = {
  PR: ["pr"],
  "2nd Floor": ["2nd floor", "2nd", "second floor", "floor 2"],
  Catering: ["catering"],
  "Ground Floor": ["ground floor", "ground"],
};

function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findRoom(rooms, sheetName) {
  const hints = ROOM_MATCH_HINTS[sheetName].map(norm);
  for (const room of rooms) {
    const rn = norm(room.name);
    const rc = norm(room.code);
    for (const h of hints) {
      if (rn === h || rc === h || rn.includes(h) || h.includes(rn)) return room;
    }
  }
  // looser fallback: any overlap
  for (const room of rooms) {
    const rn = norm(room.name);
    for (const h of hints) {
      if (rn.includes(h.slice(0, 3))) return room;
    }
  }
  return null;
}

function skuMatchesCode(sku, code) {
  if (!sku || !code) return false;
  const s = String(sku).trim();
  const c = String(code).trim();
  if (s === c) return true;
  return (
    s.toLowerCase().endsWith("-" + c.toLowerCase()) ||
    s.toLowerCase().endsWith("_" + c.toLowerCase())
  );
}

function makeSku(room, code) {
  const prefix = (room.code || room.name || "ITEM").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `${prefix}-${String(code).toUpperCase()}`;
}

async function ensureUniqueSku(baseSku) {
  let sku = baseSku;
  let n = 2;
  while (await prisma.item.findUnique({ where: { sku } })) {
    sku = `${baseSku}-${n}`;
    n++;
  }
  return sku;
}

// Inlined port of lib/services/alerts.js#refreshAlertsFor — that file uses
// ES import/export syntax meant for Next.js's bundler, so it can't be
// require()'d from a plain `node` script. Same logic, same behavior.
async function refreshAlertsFor(itemId, roomId) {
  const [item, invRow] = await Promise.all([
    prisma.item.findUnique({ where: { id: itemId } }),
    prisma.inventoryByRoom.findUnique({ where: { itemId_roomId: { itemId, roomId } } }),
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
      return prisma.alert.update({ where: { id: existingOpenAlert.id }, data: { type, message } });
    }
    return existingOpenAlert;
  }

  return prisma.alert.create({ data: { itemId, roomId, type, message } });
}

async function main() {
  const newData = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  const sheetNames = Object.keys(newData);

  const rooms = await prisma.storageRoom.findMany({ where: { isActive: true } });
  console.log("Active rooms in DB:", rooms.map((r) => `${r.name} (code=${r.code}, id=${r.id})`).join(" | "));

  const roomMap = {};
  for (const sheetName of sheetNames) {
    const room = findRoom(rooms, sheetName);
    if (!room) {
      console.error(`\n!! Could not confidently match sheet "${sheetName}" to any active room. Aborting — no changes made.`);
      console.error("   Active room names:", rooms.map((r) => r.name).join(", "));
      process.exit(1);
    }
    roomMap[sheetName] = room;
    console.log(`Matched sheet "${sheetName}" -> room "${room.name}" (${room.id})`);
  }

  const plan = {
    generatedAt: new Date().toISOString(),
    mode: APPLY ? "APPLY" : "DRY_RUN",
    excludedSheets: ["New Year", "2027 send email"],
    rooms: {},
    totals: { create: 0, update: 0, unchanged: 0, softDelete: 0 },
  };

  // Track every active item-id that gets "claimed" by a row in the new
  // file, scoped to these 4 rooms only.
  const claimedItemIds = new Set();

  for (const sheetName of sheetNames) {
    const room = roomMap[sheetName];
    const rows = newData[sheetName];

    const existingInv = await prisma.inventoryByRoom.findMany({
      where: { roomId: room.id, item: { isActive: true } },
      include: { item: { include: { category: true } } },
    });

    const roomPlan = { room: room.name, roomId: room.id, create: [], update: [], unchanged: [], softDelete: [], warnings: [] };
    const usedExistingIds = new Set();

    for (const row of rows) {
      const rowName = row.name.trim();
      // 1) exact name match within this room
      let existing = existingInv.find(
        (inv) => !usedExistingIds.has(inv.item.id) && inv.item.name.trim().toLowerCase() === rowName.toLowerCase()
      );
      // 2) fallback: SKU code-suffix match
      if (!existing) {
        existing = existingInv.find(
          (inv) => !usedExistingIds.has(inv.item.id) && skuMatchesCode(inv.item.sku, row.code)
        );
      }
      if (existing) {
        usedExistingIds.add(existing.item.id);
      }

      const notesParts = [];
      if (row.description) notesParts.push(row.description);
      if (row.color) notesParts.push(`Color: ${row.color}`);
      if (row.packUnit) notesParts.push(`Pack/Unit: ${row.packUnit}`);
      if (row.status) notesParts.push(`Status: ${row.status}`);
      if (row.out) notesParts.push(`Out: ${row.out}`);
      const notes = notesParts.join(" | ") || null;

      if (existing) {
        claimedItemIds.add(existing.item.id);
        const changes = {};
        if (existing.item.name.trim() !== rowName) changes.name = { from: existing.item.name, to: rowName };
        const currentCategory = existing.item.category?.name || null;
        if ((currentCategory || "") !== (row.category || "")) {
          changes.category = { from: currentCategory, to: row.category };
        }
        if (existing.quantity !== row.quantity) {
          changes.quantity = { from: existing.quantity, to: row.quantity };
        }
        if (Object.keys(changes).length > 0) {
          roomPlan.update.push({ itemId: existing.item.id, sku: existing.item.sku, code: row.code, changes });
        } else {
          roomPlan.unchanged.push({ itemId: existing.item.id, sku: existing.item.sku, code: row.code, name: rowName });
        }

        if (APPLY && Object.keys(changes).length > 0) {
          let categoryId = existing.item.categoryId;
          if (row.category) {
            const cat = await prisma.category.upsert({
              where: { name: row.category },
              create: { name: row.category },
              update: {},
            });
            categoryId = cat.id;
          }
          await prisma.item.update({
            where: { id: existing.item.id },
            data: { name: rowName, categoryId, notes },
          });
          if (existing.quantity !== row.quantity) {
            await prisma.inventoryByRoom.update({
              where: { itemId_roomId: { itemId: existing.item.id, roomId: room.id } },
              data: { quantity: row.quantity },
            });
            await prisma.stockMovement.create({
              data: {
                type: "ADJUST",
                itemId: existing.item.id,
                quantity: Math.abs(row.quantity - existing.quantity),
                toRoomId: room.id,
                note: `Synced from Marketing_Inventory.xlsx (set to ${row.quantity})`,
              },
            });
          }
          await refreshAlertsFor(existing.item.id, room.id);
        }
      } else {
        // New item
        const baseSku = makeSku(room, row.code || rowName);
        roomPlan.create.push({ code: row.code, name: rowName, category: row.category, quantity: row.quantity, plannedSku: baseSku });

        if (APPLY) {
          let categoryId;
          if (row.category) {
            const cat = await prisma.category.upsert({
              where: { name: row.category },
              create: { name: row.category },
              update: {},
            });
            categoryId = cat.id;
          }
          const sku = await ensureUniqueSku(baseSku);
          const created = await prisma.item.create({
            data: {
              name: rowName,
              sku,
              unit: row.packUnit || "pcs",
              categoryId: categoryId || null,
              notes,
            },
          });
          claimedItemIds.add(created.id);
          await prisma.inventoryByRoom.create({
            data: { itemId: created.id, roomId: room.id, quantity: row.quantity },
          });
          if (row.quantity > 0) {
            await prisma.stockMovement.create({
              data: {
                type: "ADD",
                itemId: created.id,
                quantity: row.quantity,
                toRoomId: room.id,
                note: "Synced from Marketing_Inventory.xlsx (new item)",
              },
            });
          }
          await refreshAlertsFor(created.id, room.id);
        }
      }
    }

    // Anything in this room not claimed -> soft-delete candidate
    for (const inv of existingInv) {
      if (!claimedItemIds.has(inv.item.id)) {
        roomPlan.softDelete.push({ itemId: inv.item.id, sku: inv.item.sku, name: inv.item.name, quantity: inv.quantity });
      }
    }

    plan.rooms[sheetName] = roomPlan;
    plan.totals.create += roomPlan.create.length;
    plan.totals.update += roomPlan.update.length;
    plan.totals.unchanged += roomPlan.unchanged.length;
    plan.totals.softDelete += roomPlan.softDelete.length;

    console.log(
      `\n[${sheetName} -> ${room.name}] create=${roomPlan.create.length} update=${roomPlan.update.length} unchanged=${roomPlan.unchanged.length} softDelete=${roomPlan.softDelete.length}`
    );
  }

  if (APPLY) {
    for (const sheetName of sheetNames) {
      const roomPlan = plan.rooms[sheetName];
      for (const del of roomPlan.softDelete) {
        await prisma.item.update({ where: { id: del.itemId }, data: { isActive: false } });
        await prisma.alert.updateMany({
          where: { itemId: del.itemId, isResolved: false },
          data: { isResolved: true, resolvedAt: new Date() },
        });
      }
    }
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(plan, null, 2));
  console.log(`\n=== TOTALS === create=${plan.totals.create} update=${plan.totals.update} unchanged=${plan.totals.unchanged} softDelete=${plan.totals.softDelete}`);
  console.log(`Full report written to ${REPORT_PATH}`);
  if (!APPLY) {
    console.log("\nThis was a DRY RUN — nothing was changed. Review sync-report.json, then re-run with --apply to commit these changes.");
  } else {
    console.log("\nAPPLY complete — the database has been updated.");
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("FATAL:", err);
  await prisma.$disconnect();
  process.exit(1);
});
