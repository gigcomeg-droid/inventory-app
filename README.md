# Inventory App

A local-only, multi-room inventory management web app for tracking stock
across **4 independently tracked storage rooms**. Quantities are always
scoped to a single room and are **never mixed** unless you're explicitly
viewing the "All Rooms" combined view (dashboard and the `/items` catalog
total column). No external network APIs are used anywhere — auth, search,
barcode/QR generation, charts, and import/export all run locally.

## Overview

- 4 physical storage rooms (`ROOM1`–`ROOM4`), each with its own independent
  quantity per item.
- A shared item catalog (name, SKU, barcode, category, supplier, unit) — the
  catalog is shared, the *stock counts* are not.
- Add / remove / adjust stock per room, or transfer stock between exactly two
  rooms in one atomic operation.
- Automatic low-stock / out-of-stock alerts per (item, room) pair.
- A local, rule-based "assistant" for natural-language-ish stock questions —
  no AI API, just keyword/regex matching against the database.
- CSV/XLSX import and export.
- Client-side barcode/QR code rendering for item labels.
- Role-based access (Admin / Manager / Staff / Viewer).
- Designed to run locally, on a private LAN server, or hosted online — see
  `DEPLOYMENT.md` for the GitHub + Vercel + Neon Postgres path.

## Features

- **Dashboard** — all-rooms totals, KPI cards, charts (stock by room, top
  low-stock items, movement trend), and the assistant panel entry point.
- **Per-room pages** (`/rooms/[roomCode]`) — one reusable page for
  ROOM1..ROOM4, clearly labeled "Storage Room N", scoped strictly to that
  room's inventory, add/edit/transfer actions, room-specific low-stock
  banner.
- **Items catalog** (`/items`) — all items with an "All Rooms" total column
  plus an expandable per-room breakdown row, search/filter, CSV/XLSX
  import/export.
- **Item detail** (`/items/[id]`) — per-room quantities, barcode/QR code,
  full movement history, edit form.
- **Movements log** (`/movements`) — global stock movement history with
  filters by item, room, type, and date.
- **Alerts** (`/alerts`) — all low/out-of-stock alerts grouped by room, with
  resolve action (Manager+).
- **Suppliers & Categories** — simple CRUD tables (Manager+ to edit).
- **User management** (`/users`, Admin only) — create/deactivate users,
  change roles.
- **Assistant / smart search** — local rule-based natural-language queries
  like "how many hammers do we have" or "what's low in storage room 3".
- Dark "ops center" UI by default, with light mode via Tailwind `dark:`
  toggle; persistent role-aware sidebar.

## Project structure

```
inventory-app/
├── app/
│   ├── layout.js               # root layout
│   ├── globals.css             # Tailwind base styles
│   ├── page.js                 # redirects to /dashboard if authed, else /login
│   ├── login/
│   │   └── page.js             # username/password login form
│   ├── (app)/                  # authenticated app shell (sidebar layout)
│   │   ├── dashboard/
│   │   │   └── page.js
│   │   ├── rooms/
│   │   │   └── [roomCode]/
│   │   │       └── page.js     # reused for ROOM1..ROOM4
│   │   ├── items/
│   │   │   ├── page.js         # all-items table, All Rooms totals
│   │   │   └── [id]/
│   │   │       └── page.js     # item detail: per-room qty, barcode/QR, history
│   │   ├── movements/
│   │   │   └── page.js
│   │   ├── alerts/
│   │   │   └── page.js
│   │   ├── suppliers/
│   │   │   └── page.js
│   │   ├── categories/
│   │   │   └── page.js
│   │   └── users/
│   │       └── page.js         # Admin only
│   └── api/
│       ├── auth/
│       │   ├── login/route.js
│       │   ├── logout/route.js
│       │   └── me/route.js
│       ├── rooms/
│       │   ├── route.js
│       │   └── [roomId]/
│       │       ├── route.js
│       │       └── inventory/route.js
│       ├── items/
│       │   ├── route.js
│       │   └── [id]/route.js
│       ├── stock/
│       │   ├── add/route.js
│       │   ├── remove/route.js
│       │   ├── adjust/route.js
│       │   └── transfer/route.js
│       ├── movements/route.js
│       ├── suppliers/
│       │   ├── route.js
│       │   └── [id]/route.js
│       ├── categories/
│       │   ├── route.js
│       │   └── [id]/route.js
│       ├── alerts/
│       │   ├── route.js
│       │   └── [id]/resolve/route.js
│       ├── assistant/
│       │   └── query/route.js
│       ├── export/route.js
│       └── import/route.js
├── components/                 # shared React components (sidebar, tables,
│                                #   cards, charts, forms, barcode display, ...)
├── lib/
│   ├── db.js                   # Prisma client singleton
│   ├── auth.js                 # session verify + requireRole()
│   ├── assistant.js            # local rule-based query parsing
│   ├── csv.js                  # CSV/XLSX read/write helpers (import/export)
│   ├── barcodeClient.js        # client-side jsbarcode/qrcode wrappers
│   ├── apiClient.js            # fetch wrapper used by frontend components
│   ├── formatters.js           # date/number/unit formatting helpers
│   └── services/
│       ├── alerts.js           # refreshAlertsFor(itemId, roomId)
│       ├── stock.js            # add/remove/adjust/transfer transaction logic
│       └── items.js            # item catalog queries (totals, perRoom, etc.)
├── prisma/
│   ├── schema.prisma           # DB schema (PostgreSQL)
│   ├── seed.js                 # demo data: rooms, items, users, stock
│   └── SAMPLE_DATA.md          # description of the seeded demo data
├── middleware.js                # route protection (session cookie check)
├── public/
│   └── uploads/                # item photos, if uploaded
├── scripts/                    # misc one-off/local scripts
├── .env.example
├── package.json
├── CONTRACT.md                 # full API/design contract (source of truth)
├── README.md                   # this file
└── DEPLOYMENT.md                # local network / private server deployment guide
```

## Tech stack

| Layer            | Technology                                         |
|-------------------|-----------------------------------------------------|
| Framework         | Next.js 14 (App Router, plain JavaScript, no TS)    |
| Styling           | Tailwind CSS                                        |
| ORM               | Prisma                                              |
| Database          | PostgreSQL (local, private server, or hosted — e.g. Neon) |
| Auth              | Cookie-based session, JWT (`jsonwebtoken`), `bcryptjs` password hashing |
| Charts            | Recharts                                            |
| Barcode / QR      | `jsbarcode`, `qrcode` (client-side, no network)     |
| Import / Export   | `xlsx` (reads/writes CSV and XLSX)                  |
| Assistant / search| Local rule-based keyword/regex matching (no AI API) |

## Setup instructions (local use)

### Prerequisites

- Node.js 18+
- npm

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env: set DATABASE_URL/DIRECT_URL to a Postgres connection string
# (a free Neon database works fine for local dev too — see DEPLOYMENT.md),
# and set JWT_SECRET to a long random value, e.g.:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. Generate the Prisma client
npm run db:generate

# 4. Create the database tables from the schema
npm run db:migrate

# 5. Load sample/demo data (rooms, items, users, stock)
npm run db:seed

# 6. Start the dev server
npm run dev
```

Then open **http://localhost:3000**.

> Steps 1–5 can also be run in one shot with `npm run setup`.

## Demo login credentials

Seeded by `prisma/seed.js` for local evaluation. **Change or remove these
before using the app with real inventory data.**

| Username  | Password    | Role    |
|-----------|-------------|---------|
| `admin`   | `admin123`  | ADMIN   |
| `manager` | `manager123`| MANAGER |
| `staff`   | `staff123`  | STAFF   |
| `viewer`  | `viewer123` | VIEWER  |

## How stock separation works

Item **quantities never live on the `Item` record itself**. Instead, every
quantity lives in `InventoryByRoom`, a table keyed by the unique pair
`(itemId, roomId)`:

- Each room's stock count for an item is a fully independent row. Adding
  stock to Room 2 never touches Room 1's count for the same item.
- The `/api/rooms/[roomId]/inventory` endpoint only ever returns rows for
  that one room — quantities from other rooms are not summed in or exposed.
- The `/api/items` "All Rooms" / dashboard view is the *only* place per-room
  numbers are summed together, via an explicit `totalQuantity` field
  alongside a `perRoom` breakdown array — so the combined view is always
  opt-in and explicit, never an accidental mix-up.
- **Transfers** (`POST /api/stock/transfer`) move stock between exactly two
  rooms atomically inside a single database transaction: decrement the
  source room's `InventoryByRoom` row, increment the destination room's row,
  and insert one `TRANSFER` movement recording both `fromRoomId` and
  `toRoomId`. If the source room doesn't have enough stock, or the source and
  destination are the same room, the whole operation is rejected — there is
  no partial transfer.
- Every add/remove/adjust/transfer is logged to `stock_movements`, so the
  full history of how stock moved between or within rooms is always
  auditable.
- Low-stock alerts are computed and stored **per (item, room) pair**, so a
  room can be flagged low on an item while another room is fully stocked on
  the same item.

## Roles & permissions

Roles are hierarchical: `ADMIN > MANAGER > STAFF > VIEWER` (each higher role
includes everything the lower roles can do).

| Action                                         | Viewer | Staff | Manager | Admin |
|-------------------------------------------------|:------:|:-----:|:-------:|:-----:|
| View rooms, items, movements, alerts (read-only) | Yes | Yes | Yes | Yes |
| Use assistant / smart search                     | Yes | Yes | Yes | Yes |
| Export data (CSV/XLSX)                           | Yes | Yes | Yes | Yes |
| Create items                                     | — | Yes | Yes | Yes |
| Add / remove / adjust stock                      | — | Yes | Yes | Yes |
| Transfer stock between rooms                     | — | Yes | Yes | Yes |
| Import CSV/XLSX                                  | — | Yes | Yes | Yes |
| Edit / delete items                              | — | — | Yes | Yes |
| Manage suppliers & categories                    | — | — | Yes | Yes |
| Resolve alerts                                   | — | — | Yes | Yes |
| Manage users (create/deactivate, change roles)   | — | — | — | Yes |

Enforced server-side by a `requireRole(session, ['ADMIN', 'MANAGER'])`
helper in `lib/auth.js`, called at the top of each protected API route.
`middleware.js` also protects all pages/API routes except `/login`,
`/api/auth/login`, and Next.js static assets — unauthenticated requests are
redirected to `/login` (pages) or get a `401` (API).

## Assistant / smart search

The assistant (`POST /api/assistant/query`, implemented in `lib/assistant.js`)
is **100% local, rule-based keyword/regex matching against the database** —
it is not an external AI API, there are no network calls, and no LLM is
involved. It parses a small set of intents and falls back to a fuzzy
substring search across item name/SKU/barcode.

Example queries:

- "how many hammers do we have" / "total drill bits" → sums quantity across
  all 4 rooms.
- "low stock in room 2" / "what's low in storage room 3" → filters open
  alerts by room.
- "where is the extension cord" / "which room has safety goggles" →
  per-room quantity breakdown for that item.
- "out of stock" → items with any room currently at 0.
- Anything else → fuzzy substring search across name/SKU/barcode.

## Barcode / QR codes

Barcodes and QR codes are rendered **entirely client-side** using the local
`jsbarcode` and `qrcode` npm packages — there is no API route and no network
call involved. `lib/barcodeClient.js` exports:

- `renderBarcode(canvas, value)` — wraps `jsbarcode`.
- `renderQrCode(canvasOrCallback, value)` — wraps `qrcode`.

Components (e.g. the item detail page) call these directly to draw a code
onto a `<canvas>`. If an item has no `barcode` set, its `sku` is used as the
encoded value by default.

## Import / Export

Available from the `/items` page (STAFF+ for import, everyone for export)
and via `GET /api/export` / `POST /api/import`. Both CSV and XLSX are
supported through the `xlsx` package, which reads and writes both formats.

**Export** — `GET /api/export?type=items|movements|room&roomId=&format=csv|xlsx`
streams a file with the correct `Content-Disposition` header for download.

**Import** — `POST /api/import` (STAFF+), multipart form with a `file`
(`.csv` or `.xlsx`) and a `roomId` (the stock quantities in the file apply to
that one room). Expected columns:

| Column          | Description                                      |
|------------------|---------------------------------------------------|
| `name`           | Item name                                          |
| `sku`            | Unique SKU — used as the upsert key                |
| `barcode`        | Optional barcode value                             |
| `category`       | Category name (created if it doesn't exist)        |
| `unit`           | Unit of measure (e.g. `pcs`, `box`, `kg`)          |
| `quantity`       | Stock quantity for the target room                 |
| `minStockLevel`  | Low-stock threshold override for this room         |
| `supplier`       | Supplier name (created if it doesn't exist)        |
| `notes`          | Free-text notes                                    |

Rows are upserted by `sku`. The response reports
`{ created, updated, skipped, errors: [...] }` so you can see exactly what
happened after an import.
