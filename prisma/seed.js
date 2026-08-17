// Seed script — run with `node prisma/seed.js` (also wired up as the
// `prisma.seed` script in package.json, so `prisma migrate reset` picks it
// up automatically). Plain CommonJS on purpose: this runs directly under
// `node`, not through Next.js's bundler, so ESM import/export syntax would
// fail without a package.json "type":"module" flag we don't want to add.
//
// NOTE: this script is NOT idempotent — running it twice will create
// duplicate rooms/users/items (unique constraints on username/sku/barcode/
// room code will make a second run fail partway through). That's fine for
// local dev: use `npx prisma migrate reset` (which re-runs this seed
// automatically) to get back to a clean, freshly-seeded database.
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

// -- Alert refresh logic, replicated inline (see lib/services/alerts.js for
// the canonical version used by the running app) so this script has no
// dependency on the app's ESM lib/ modules. --------------------------------
async function refreshAlertsFor(itemId, roomId) {
  const [item, invRow] = await Promise.all([
    prisma.item.findUnique({ where: { id: itemId } }),
    prisma.inventoryByRoom.findUnique({
      where: { itemId_roomId: { itemId, roomId } },
    }),
  ]);
  if (!item) return;

  const quantity = invRow?.quantity ?? 0;
  const minStockLevel = invRow?.minStockLevel ?? item.defaultMinStockLevel ?? 0;
  if (quantity > minStockLevel) return; // not low — nothing to create

  const type = quantity <= 0 ? "OUT_OF_STOCK" : "LOW_STOCK";
  const message =
    type === "OUT_OF_STOCK"
      ? `${item.name} is out of stock`
      : `${item.name} is low on stock (${quantity} ${item.unit} left, min ${minStockLevel})`;

  await prisma.alert.create({ data: { itemId, roomId, type, message } });
}

async function main() {
  console.log("Seeding database...");

  // ---------------------------------------------------------------------
  // Storage rooms
  // ---------------------------------------------------------------------
  const roomDefs = [
    {
      code: "ROOM1",
      name: "Storage Room 1 — Main Warehouse",
      location: "Building A, Ground Floor",
      description: "Primary bulk storage for cleaning, safety and general supplies.",
      sortOrder: 1,
    },
    {
      code: "ROOM2",
      name: "Storage Room 2 — Office Supplies",
      location: "Building A, 2nd Floor",
      description: "Office & pantry consumables closet near the admin wing.",
      sortOrder: 2,
    },
    {
      code: "ROOM3",
      name: "Storage Room 3 — Electronics & IT",
      location: "Building B, Room 104",
      description: "IT hardware, cables and accessories cage.",
      sortOrder: 3,
    },
    {
      code: "ROOM4",
      name: "Storage Room 4 — Maintenance & Tools",
      location: "Building B, Basement",
      description: "Tools, hardware and maintenance equipment store.",
      sortOrder: 4,
    },
  ];

  const rooms = {};
  for (const def of roomDefs) {
    rooms[def.code] = await prisma.storageRoom.create({ data: def });
  }
  console.log(`Created ${Object.keys(rooms).length} storage rooms.`);

  // ---------------------------------------------------------------------
  // Users (one per role)
  // ---------------------------------------------------------------------
  const userDefs = [
    { username: "admin", password: "admin123", name: "Aya Hassan", role: "ADMIN" },
    { username: "manager", password: "manager123", name: "Mostafa Nabil", role: "MANAGER" },
    { username: "staff", password: "staff123", name: "Youssef Adel", role: "STAFF" },
    { username: "viewer", password: "viewer123", name: "Nourhan Kamal", role: "VIEWER" },
  ];

  const users = {};
  for (const def of userDefs) {
    const passwordHash = await bcrypt.hash(def.password, 10);
    users[def.role] = await prisma.user.create({
      data: {
        username: def.username,
        passwordHash,
        name: def.name,
        role: def.role,
      },
    });
  }
  console.log(`Created ${Object.keys(users).length} users (admin/admin123, manager/manager123, staff/staff123, viewer/viewer123).`);

  // ---------------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------------
  const categoryDefs = [
    { name: "Office Supplies", description: "Paper, pens, desk essentials." },
    { name: "Cleaning Supplies", description: "Cleaning chemicals and consumables." },
    { name: "Electronics", description: "IT hardware and accessories." },
    { name: "Tools & Hardware", description: "Hand tools, power tools, fasteners." },
    { name: "Safety Equipment", description: "PPE and first-aid supplies." },
    { name: "Kitchen & Pantry", description: "Break room and pantry consumables." },
  ];

  const categories = {};
  for (const def of categoryDefs) {
    categories[def.name] = await prisma.category.create({ data: def });
  }
  console.log(`Created ${Object.keys(categories).length} categories.`);

  // ---------------------------------------------------------------------
  // Suppliers
  // ---------------------------------------------------------------------
  const supplierDefs = [
    { name: "Acme Wholesale", contactName: "Tarek Fathy", email: "sales@acmewholesale.example", phone: "555-0101" },
    { name: "Global Office Depot", contactName: "Salma Reda", email: "orders@globalofficedepot.example", phone: "555-0102" },
    { name: "BrightClean Co.", contactName: "Hana Farouk", email: "info@brightclean.example", phone: "555-0103" },
    { name: "TechSource Inc.", contactName: "Omar Sherif", email: "b2b@techsource.example", phone: "555-0104" },
    { name: "Metro Hardware Supply", contactName: "Laila Ibrahim", email: "sales@metrohardware.example", phone: "555-0105" },
  ];

  const suppliers = {};
  for (const def of supplierDefs) {
    suppliers[def.name] = await prisma.supplier.create({ data: def });
  }
  console.log(`Created ${Object.keys(suppliers).length} suppliers.`);

  // ---------------------------------------------------------------------
  // Items + per-room initial stock
  // Each entry: item master fields + { ROOM_CODE: quantity } stock map.
  // ---------------------------------------------------------------------
  const itemDefs = [
    {
      name: "Paper Towels (Case)", sku: "PT-001", unit: "case",
      category: "Cleaning Supplies", supplier: "BrightClean Co.", defaultMinStockLevel: 10,
      stock: { ROOM1: 40, ROOM2: 5 }, // ROOM2 below min -> low stock
    },
    {
      name: "All-Purpose Cleaner (1L)", sku: "CL-002", unit: "bottle",
      category: "Cleaning Supplies", supplier: "BrightClean Co.", defaultMinStockLevel: 15,
      stock: { ROOM1: 60, ROOM4: 8 }, // ROOM4 low
    },
    {
      name: "Disposable Gloves (Box)", sku: "GL-003", unit: "box",
      category: "Safety Equipment", supplier: "Metro Hardware Supply", defaultMinStockLevel: 20,
      stock: { ROOM1: 100, ROOM4: 12 }, // ROOM4 low
    },
    {
      name: "Safety Goggles", sku: "SG-004", unit: "pcs",
      category: "Safety Equipment", supplier: "Metro Hardware Supply", defaultMinStockLevel: 10,
      stock: { ROOM1: 25, ROOM4: 6 }, // ROOM4 low
    },
    {
      name: "First Aid Kit", sku: "FA-005", unit: "kit",
      category: "Safety Equipment", supplier: "Metro Hardware Supply", defaultMinStockLevel: 3,
      stock: { ROOM1: 8, ROOM2: 2, ROOM3: 4, ROOM4: 5 }, // ROOM2 low
    },
    {
      name: "A4 Paper (Ream)", sku: "PP-006", unit: "ream",
      category: "Office Supplies", supplier: "Global Office Depot", defaultMinStockLevel: 25,
      stock: { ROOM2: 150, ROOM1: 10 }, // ROOM1 low
    },
    {
      name: "Ballpoint Pens (Box of 12)", sku: "PN-007", unit: "box",
      category: "Office Supplies", supplier: "Global Office Depot", defaultMinStockLevel: 10,
      stock: { ROOM2: 45 },
    },
    {
      name: "Sticky Notes (Pack)", sku: "SN-008", unit: "pack",
      category: "Office Supplies", supplier: "Global Office Depot", defaultMinStockLevel: 15,
      stock: { ROOM2: 30, ROOM3: 5 }, // ROOM3 low
    },
    {
      name: "Stapler", sku: "ST-009", unit: "pcs",
      category: "Office Supplies", supplier: "Global Office Depot", defaultMinStockLevel: 5,
      stock: { ROOM2: 12 },
    },
    {
      name: "Printer Toner Cartridge", sku: "TN-010", unit: "pcs",
      category: "Electronics", supplier: "TechSource Inc.", defaultMinStockLevel: 6,
      stock: { ROOM3: 3, ROOM2: 4 }, // both low
    },
    {
      name: "USB Flash Drive 32GB", sku: "USB-011", unit: "pcs",
      category: "Electronics", supplier: "TechSource Inc.", defaultMinStockLevel: 10,
      stock: { ROOM3: 40 },
    },
    {
      name: "HDMI Cable 2m", sku: "HD-012", unit: "pcs",
      category: "Electronics", supplier: "TechSource Inc.", defaultMinStockLevel: 8,
      stock: { ROOM3: 0 }, // out of stock
    },
    {
      name: "Wireless Mouse", sku: "WM-013", unit: "pcs",
      category: "Electronics", supplier: "TechSource Inc.", defaultMinStockLevel: 5,
      stock: { ROOM3: 18 },
    },
    {
      name: "Extension Cord 5m", sku: "EC-014", unit: "pcs",
      category: "Tools & Hardware", supplier: "Acme Wholesale", defaultMinStockLevel: 8,
      stock: { ROOM4: 20, ROOM1: 3 }, // ROOM1 low
    },
    {
      name: "Cordless Drill", sku: "DR-015", unit: "pcs",
      category: "Tools & Hardware", supplier: "Acme Wholesale", defaultMinStockLevel: 2,
      stock: { ROOM4: 6 },
    },
    {
      name: "Assorted Screws (Box)", sku: "SC-016", unit: "box",
      category: "Tools & Hardware", supplier: "Acme Wholesale", defaultMinStockLevel: 10,
      stock: { ROOM4: 4 }, // low
    },
    {
      name: "Duct Tape Roll", sku: "DT-017", unit: "roll",
      category: "Tools & Hardware", supplier: "Acme Wholesale", defaultMinStockLevel: 12,
      stock: { ROOM4: 35, ROOM1: 6 }, // ROOM1 low
    },
    {
      name: "Coffee (1kg Bag)", sku: "CF-018", unit: "bag",
      category: "Kitchen & Pantry", supplier: "Acme Wholesale", defaultMinStockLevel: 6,
      stock: { ROOM2: 15 },
    },
    {
      name: "Bottled Water (24-pack)", sku: "WT-019", unit: "case",
      category: "Kitchen & Pantry", supplier: "Acme Wholesale", defaultMinStockLevel: 10,
      stock: { ROOM1: 25, ROOM2: 0 }, // ROOM2 out of stock
    },
    {
      name: "Paper Cups (Sleeve of 50)", sku: "CP-020", unit: "sleeve",
      category: "Kitchen & Pantry", supplier: "Acme Wholesale", defaultMinStockLevel: 8,
      stock: { ROOM2: 20 },
    },
  ];

  const items = {};
  for (const def of itemDefs) {
    items[def.sku] = await prisma.item.create({
      data: {
        name: def.name,
        sku: def.sku,
        unit: def.unit,
        defaultMinStockLevel: def.defaultMinStockLevel,
        categoryId: categories[def.category].id,
        supplierId: suppliers[def.supplier].id,
      },
    });
  }
  console.log(`Created ${Object.keys(items).length} items.`);

  // ---------------------------------------------------------------------
  // Per-room inventory + a realistic mix of stock movements.
  // Most rows get one straightforward ADD movement equal to their target
  // quantity. A few rows are given a small narrative (ADD then REMOVE /
  // ADJUST / TRANSFER) so the movement log has a real mix of all 4 types.
  // ---------------------------------------------------------------------

  async function setInitialStock(sku, roomCode, quantity, userId) {
    const item = items[sku];
    const room = rooms[roomCode];
    await prisma.inventoryByRoom.create({
      data: { itemId: item.id, roomId: room.id, quantity },
    });
    await prisma.stockMovement.create({
      data: {
        type: "ADD",
        itemId: item.id,
        quantity,
        toRoomId: room.id,
        note: "Initial stock",
        userId,
      },
    });
  }

  const staffId = users.STAFF.id;
  const managerId = users.MANAGER.id;

  for (const def of itemDefs) {
    for (const [roomCode, quantity] of Object.entries(def.stock)) {
      // Skip the rows we're about to handle with a special narrative below.
      const special = new Set(["PT-001:ROOM1", "SG-004:ROOM1", "EC-014:ROOM1", "EC-014:ROOM4", "HD-012:ROOM3", "WT-019:ROOM2"]);
      if (special.has(`${def.sku}:${roomCode}`)) continue;
      await setInitialStock(def.sku, roomCode, quantity, staffId);
    }
  }

  // -- REMOVE example: Paper Towels ROOM1 — stocked 50, 10 used, ends at 40.
  await setInitialStock("PT-001", "ROOM1", 50, staffId);
  await prisma.inventoryByRoom.update({
    where: { itemId_roomId: { itemId: items["PT-001"].id, roomId: rooms.ROOM1.id } },
    data: { quantity: { decrement: 10 } },
  });
  await prisma.stockMovement.create({
    data: {
      type: "REMOVE",
      itemId: items["PT-001"].id,
      quantity: 10,
      fromRoomId: rooms.ROOM1.id,
      note: "Used for office cleanup",
      userId: staffId,
    },
  });

  // -- ADJUST example: Safety Goggles ROOM1 — stocked 30, physical count found 25.
  await setInitialStock("SG-004", "ROOM1", 30, staffId);
  await prisma.inventoryByRoom.update({
    where: { itemId_roomId: { itemId: items["SG-004"].id, roomId: rooms.ROOM1.id } },
    data: { quantity: 25 },
  });
  await prisma.stockMovement.create({
    data: {
      type: "ADJUST",
      itemId: items["SG-004"].id,
      quantity: 5,
      toRoomId: rooms.ROOM1.id,
      note: "Adjusted by -5 — Physical count correction",
      userId: managerId,
    },
  });

  // -- TRANSFER example: Extension Cord — 23 stocked in ROOM1, 20 transferred to ROOM4.
  await setInitialStock("EC-014", "ROOM1", 23, staffId);
  await prisma.inventoryByRoom.update({
    where: { itemId_roomId: { itemId: items["EC-014"].id, roomId: rooms.ROOM1.id } },
    data: { quantity: { decrement: 20 } },
  });
  await prisma.inventoryByRoom.create({
    data: { itemId: items["EC-014"].id, roomId: rooms.ROOM4.id, quantity: 20 },
  });
  await prisma.stockMovement.create({
    data: {
      type: "TRANSFER",
      itemId: items["EC-014"].id,
      quantity: 20,
      fromRoomId: rooms.ROOM1.id,
      toRoomId: rooms.ROOM4.id,
      note: "Rebalanced stock to maintenance room",
      userId: staffId,
    },
  });

  // -- REMOVE (to zero) example: HDMI Cable ROOM3 — stocked 15, all used, ends at 0.
  await setInitialStock("HD-012", "ROOM3", 15, staffId);
  await prisma.inventoryByRoom.update({
    where: { itemId_roomId: { itemId: items["HD-012"].id, roomId: rooms.ROOM3.id } },
    data: { quantity: { decrement: 15 } },
  });
  await prisma.stockMovement.create({
    data: {
      type: "REMOVE",
      itemId: items["HD-012"].id,
      quantity: 15,
      fromRoomId: rooms.ROOM3.id,
      note: "Used for new workstation setups",
      userId: staffId,
    },
  });

  // -- REMOVE (to zero) example: Bottled Water ROOM2 — stocked 12, all used, ends at 0.
  await setInitialStock("WT-019", "ROOM2", 12, staffId);
  await prisma.inventoryByRoom.update({
    where: { itemId_roomId: { itemId: items["WT-019"].id, roomId: rooms.ROOM2.id } },
    data: { quantity: { decrement: 12 } },
  });
  await prisma.stockMovement.create({
    data: {
      type: "REMOVE",
      itemId: items["WT-019"].id,
      quantity: 12,
      fromRoomId: rooms.ROOM2.id,
      note: "Consumed during office event",
      userId: managerId,
    },
  });

  const movementCount = await prisma.stockMovement.count();
  console.log(`Created ${movementCount} stock movements.`);

  // ---------------------------------------------------------------------
  // Alerts — refresh every (item, room) pair now that final quantities
  // are set, so low-stock/out-of-stock alerts have real data from the start.
  // ---------------------------------------------------------------------
  const allInventoryRows = await prisma.inventoryByRoom.findMany();
  for (const row of allInventoryRows) {
    await refreshAlertsFor(row.itemId, row.roomId);
  }
  const alertCount = await prisma.alert.count();
  console.log(`Created ${alertCount} alerts.`);

  console.log("Seeding complete.");
  console.log("");
  console.log("Demo logins:");
  console.log("  admin    / admin123    (ADMIN)");
  console.log("  manager  / manager123  (MANAGER)");
  console.log("  staff    / staff123    (STAFF)");
  console.log("  viewer   / viewer123   (VIEWER)");
}

main()
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
