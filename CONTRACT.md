# Build contract — shared reference for all contributors

This file is the single source of truth so backend, frontend, and docs stay in
sync. Read `prisma/schema.prisma` first, then this file.

Stack: Next.js 14 (App Router, **plain JavaScript**, not TypeScript), Tailwind
CSS, Prisma ORM, SQLite by default (Postgres-ready). No external network APIs
anywhere — auth, search/assistant, barcode/QR, charts, import/export are all
local.

## File ownership (avoid collisions)

- **Backend owns:** `middleware.js`, `lib/db.js`, `lib/auth.js`,
  `lib/services/**`, `lib/assistant.js`, `lib/csv.js`, `app/api/**`,
  `prisma/seed.js`.
- **Frontend owns:** `app/layout.js`, `app/globals.css`, `app/page.js`,
  `app/login/**`, `app/(app)/**` (dashboard/rooms/items/etc pages),
  `components/**`, `lib/barcodeClient.js`, `lib/apiClient.js`,
  `lib/formatters.js`.
- Both sides only *consume* `prisma/schema.prisma`; do not edit it — if a
  field is missing, add a note in your final summary instead of changing it.

## Auth model

- Cookie-based session: `POST /api/auth/login` verifies
  `username`/`password` (bcryptjs) against `User`, signs a JWT
  (`jsonwebtoken`, secret = `process.env.JWT_SECRET`) containing
  `{ sub: user.id, role: user.role }`, and sets it as an `httpOnly`,
  `sameSite=lax` cookie named `session` (`maxAge` = `SESSION_MAX_AGE` env,
  default 28800s).
- `GET /api/auth/me` returns `{ user }` or 401.
- `POST /api/auth/logout` clears the cookie.
- `middleware.js` protects all routes except `/login`, `/api/auth/login`,
  and Next static assets — unauthenticated requests to pages redirect to
  `/login`; unauthenticated API requests get `401 { error }`.
- Roles: `ADMIN > MANAGER > STAFF > VIEWER`.
  - `VIEWER`: read-only (GET everywhere), can use the assistant/search and
    export, cannot add/edit/delete/transfer stock, cannot import.
  - `STAFF`: everything VIEWER can, plus create items, add/remove/adjust
    stock, transfer stock between rooms, import CSV/XLSX.
  - `MANAGER`: everything STAFF can, plus edit/delete items, manage
    suppliers/categories, resolve alerts.
  - `ADMIN`: everything MANAGER can, plus manage users (create/deactivate,
    change roles).
  - Enforce with a small helper `requireRole(session, ['ADMIN','MANAGER'])`
    in `lib/auth.js`, called at the top of each API route handler.

## REST API surface (all under `/api`, JSON in/out unless noted)

### Auth
- `POST /api/auth/login` — `{ username, password }` → `{ user }`, sets cookie.
- `POST /api/auth/logout` → `{ ok: true }`.
- `GET /api/auth/me` → `{ user }` | 401.

### Rooms
- `GET /api/rooms` → `[{ id, code, name, location, itemCount, totalUnits, lowStockCount }]` (4 seeded rooms: ROOM1..ROOM4).
- `GET /api/rooms/[roomId]` → room detail + summary counts.
- `GET /api/rooms/[roomId]/inventory?search=&category=&lowStockOnly=` →
  `[{ itemId, name, sku, barcode, unit, category, quantity, minStockLevel, isLowStock }]`
  — **only** rows for that room; never mixes other rooms' quantities.

### Items (catalog + cross-room view)
- `GET /api/items?search=&category=&supplier=&lowStockOnly=` →
  `[{ id, name, sku, barcode, unit, category, supplier, totalQuantity, perRoom: [{roomId, roomCode, quantity, minStockLevel, isLowStock}], defaultMinStockLevel, photoUrl }]`.
  `totalQuantity` is the sum across all 4 rooms — used for the "All Rooms" /
  dashboard view only.
- `GET /api/items/[id]` → single item with full `perRoom` breakdown and
  recent movements.
- `POST /api/items` (STAFF+) → create item. Body may include
  `initialStock: [{ roomId, quantity }]` to seed starting quantities (each
  creates an `InventoryByRoom` row + an `ADD` movement).
- `PUT /api/items/[id]` (STAFF+ for stock fields; MANAGER+ for delete) →
  update item master fields (name, sku, barcode, category, supplier, unit,
  defaultMinStockLevel, notes, photoUrl). Does **not** touch quantities —
  quantities only change via `/api/stock/*`.
- `DELETE /api/items/[id]` (MANAGER+) → soft-delete (`isActive=false`).

### Stock operations (all log to `stock_movements`, all room-scoped)
- `POST /api/stock/add` (STAFF+) — `{ itemId, roomId, quantity, note }` →
  increments `InventoryByRoom` for that room only, creates `ADD` movement,
  recomputes alert for that (item, room).
- `POST /api/stock/remove` (STAFF+) — `{ itemId, roomId, quantity, note }` →
  decrements that room's quantity (reject if it would go negative), creates
  `REMOVE` movement, recomputes alert.
- `POST /api/stock/adjust` (STAFF+) — `{ itemId, roomId, newQuantity, note }`
  → sets the room's quantity directly (e.g. after a physical count), logs
  `ADJUST` with the signed delta in the note, recomputes alert.
- `POST /api/stock/transfer` (STAFF+) — `{ itemId, fromRoomId, toRoomId, quantity, note }`
  → in a single DB transaction: decrement `fromRoomId`, increment
  `toRoomId`, insert one `TRANSFER` movement recording both rooms, recompute
  alerts for both rooms. Reject if source room lacks sufficient quantity or
  `fromRoomId === toRoomId`.

### Movements (history log)
- `GET /api/movements?itemId=&roomId=&type=&limit=50&before=` → newest-first
  list with item name/sku, room codes, user name, timestamp.

### Suppliers / Categories
- `GET/POST /api/suppliers`, `PUT/DELETE /api/suppliers/[id]` (MANAGER+ for
  write).
- `GET/POST /api/categories`, `PUT/DELETE /api/categories/[id]` (MANAGER+
  for write).

### Alerts
- `GET /api/alerts?roomId=&resolved=false` → low/out-of-stock alerts,
  per room.
- `POST /api/alerts/[id]/resolve` (MANAGER+).
- Alerts are recomputed automatically after every stock operation by
  `lib/services/alerts.js#refreshAlertsFor(itemId, roomId)`: if
  `quantity <= effectiveMinStockLevel` and no unresolved alert exists,
  create one; if stock recovers above the threshold, auto-resolve any open
  alert for that pair.

### Assistant / smart search (rule-based, fully local)
- `POST /api/assistant/query` — `{ q: string }` → `{ answer: string, items: [...], suggestions: [...] }`.
  Implemented in `lib/assistant.js` with simple intent parsing (regex +
  keyword rules), e.g.:
  - "how many <item> do we have" / "total <item>" → sums across rooms.
  - "low stock in room 2" / "what's low in storage room 3" → filters alerts
    by room.
  - "where is <item>" / "which room has <item>" → per-room breakdown.
  - "out of stock" → items with any room at 0.
  - default → falls back to fuzzy substring search across name/sku/barcode.
  No network calls, no LLM — pure JS string matching + Prisma queries.

### Import / Export (CSV & XLSX, via the `xlsx` package — reads/writes both)
- `GET /api/export?type=items|movements|room&roomId=&format=csv|xlsx` →
  file stream with correct `Content-Disposition`.
- `POST /api/import` (STAFF+) — multipart form with `file` (csv or xlsx) and
  `roomId` (stock quantities in the file apply to this room). Expected
  columns: `name, sku, barcode, category, unit, quantity, minStockLevel, supplier, notes`.
  Upserts by `sku`; returns `{ created, updated, skipped, errors: [...] }`.

### Barcode / QR
- Generated **client-side only**, no API route: `lib/barcodeClient.js`
  exports `renderBarcode(canvas, value)` (wraps `jsbarcode`) and
  `renderQrCode(canvasOrCallback, value)` (wraps `qrcode`). Components call
  these directly. If an item has no `barcode` set, default to its `sku` as
  the encoded value.

## Standard error shape

Every failed API response: `{ "error": "human readable message" }` with an
appropriate HTTP status (400 validation, 401 auth, 403 role, 404 missing,
409 conflict e.g. insufficient stock, 500 unexpected).

## Frontend routes (App Router pages)

- `/login` — username/password form.
- `/` (dashboard) — redirects to `/dashboard` if authed.
- `/dashboard` — all-rooms totals, KPI cards, charts (stock by room, top
  low-stock items, movement trend), assistant panel entry point.
- `/rooms/[roomCode]` — one page reused for ROOM1..ROOM4 via dynamic
  segment; header clearly labeled "Storage Room N"; table scoped to that
  room only, low-stock banner for that room only, add/edit/transfer actions.
- `/items` — all-items table, "All Rooms" total column + per-room
  breakdown expandable row, search/filter, CSV/XLSX import+export buttons.
- `/items/[id]` — item detail: per-room quantities, barcode/QR, movement
  history, edit form.
- `/movements` — global stock movement history log with filters.
- `/alerts` — all low-stock alerts grouped by room.
- `/suppliers`, `/categories` — simple CRUD tables (MANAGER+ to edit).
- `/users` — user management (ADMIN only).
- Persistent sidebar with nav for all of the above, current-user chip, and
  role-aware hiding of actions the current user can't perform.

## Design direction

Dark, "AI ops center" aesthetic by default (with light mode supported via
Tailwind `dark:` class toggle): deep navy/near-black background
(`base-950`/`base-900`), indigo/blue primary accent (`brand-500`), teal +
purple + amber as secondary accents for charts/status, glowing card borders
(`shadow-glow`), rounded-2xl cards, subtle grid/gradient background
(`bg-grid-glow`). Sidebar fixed on desktop, collapsible drawer on
tablet/mobile. Assistant panel is a slide-over / docked chat-style panel
with a text input and suggested-query chips.
