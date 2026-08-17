# Sample / demo data (`prisma/seed.js`)

This describes what the seed script is designed to produce for local
evaluation and demos. It is illustrative — exact item names/quantities in
the actual `prisma/seed.js` may differ slightly, but the shape (rooms,
counts, roles, low-stock scenarios) matches this doc.

Run it with:

```bash
npm run db:seed
```

It is safe to re-run against a fresh database (`npm run db:migrate` then
`npm run db:seed`); it is not designed to be idempotent against
already-seeded data — reset the database first if you need a clean reseed.

## Storage rooms (4)

| Code    | Name              | Location            |
|---------|-------------------|----------------------|
| ROOM1   | Storage Room 1     | Main building, ground floor |
| ROOM2   | Storage Room 2     | Main building, first floor  |
| ROOM3   | Storage Room 3     | Warehouse annex             |
| ROOM4   | Storage Room 4     | Warehouse annex, cold area  |

## Users (4, one per role)

| Username  | Password     | Role    | Name              |
|-----------|--------------|---------|--------------------|
| `admin`   | `admin123`   | ADMIN   | System Admin       |
| `manager` | `manager123` | MANAGER | Inventory Manager  |
| `staff`   | `staff123`   | STAFF   | Warehouse Staff     |
| `viewer`  | `viewer123`  | VIEWER  | Read-Only Viewer   |

Passwords are hashed with `bcryptjs` before being stored — the plaintext
values above are only known because the seed script sets them, not because
they're recoverable from the database.

## Categories (~5)

Tools, Office Supplies, Electronics, Safety Equipment, Cleaning Supplies.

## Suppliers (~4)

A handful of fictional suppliers (e.g. "Acme Tools Co.", "Northwind Office
Supply", "BrightSpark Electronics", "SafeGuard Industrial") each with a
contact name, email, and phone — enough to demonstrate the supplier CRUD
pages and the item-to-supplier relationship.

## Items (~18–20)

A mix of everyday inventory items across the categories above, each with a
unique SKU, a unit of measure (`pcs`, `box`, `pair`, etc.), and a
`defaultMinStockLevel`. Examples:

| Name                  | SKU        | Category            | Unit  |
|------------------------|------------|-----------------------|-------|
| Claw Hammer             | TL-001     | Tools                 | pcs   |
| Cordless Drill           | TL-002     | Tools                 | pcs   |
| Safety Goggles           | SF-001     | Safety Equipment      | pair  |
| Nitrile Gloves (box)     | SF-002     | Safety Equipment      | box   |
| Hi-Vis Vest              | SF-003     | Safety Equipment      | pcs   |
| A4 Paper Ream            | OF-001     | Office Supplies       | box   |
| Ballpoint Pens (box)     | OF-002     | Office Supplies       | box   |
| Extension Cord 10m       | EL-001     | Electronics           | pcs   |
| LED Work Light           | EL-002     | Electronics           | pcs   |
| Multimeter               | EL-003     | Electronics           | pcs   |
| All-Purpose Cleaner      | CL-001     | Cleaning Supplies     | pcs   |
| Paper Towels (pack)      | CL-002     | Cleaning Supplies     | pack  |
| Trash Bags (box)         | CL-003     | Cleaning Supplies     | box   |
| ... (a few more per category to reach ~18–20 total)

Each item is seeded with a `barcode` (or left to default to its SKU when
rendering) and, for a handful of items, a placeholder `photoUrl`.

## Per-room stock (`InventoryByRoom`)

Every item gets a stock row in some or all of the 4 rooms, with varied
quantities so the "All Rooms" total and the per-room breakdown look
realistic and differ from each other. To demonstrate the alert system:

- **A few items are seeded intentionally low** in one specific room (their
  room quantity at or below `minStockLevel`) while healthy in the others —
  e.g. Safety Goggles low in ROOM3 only.
- **At least one item is seeded at zero** in a room to demonstrate an
  `OUT_OF_STOCK` alert, e.g. Extension Cord 10m at 0 in ROOM4.
- Most items are stocked comfortably above their threshold in most rooms, so
  the dashboard/alerts pages show a realistic mix of healthy vs. flagged
  stock rather than everything being an alert.

## Alerts

Corresponding `Alert` rows (`LOW_STOCK` / `OUT_OF_STOCK`) are created for
every (item, room) pair seeded at or below its effective minimum stock
level, matching what `lib/services/alerts.js#refreshAlertsFor` would compute
at runtime — so `/alerts` has real, non-empty data immediately after
seeding.

## Stock movements

A short history of `ADD` movements (one per seeded stock row, attributed to
the `admin` user) plus a couple of illustrative `TRANSFER` and `ADJUST`
entries between rooms, so `/movements` and an item's movement history aren't
empty on first load.
