// Read-only data lookups exposed to the AI assistant as "tools" (Claude's
// tool-use / function-calling). Deliberately read-only — the assistant can
// answer questions about stock, but can never add/remove/transfer stock or
// edit/delete anything itself. Every query here is scoped the same way the
// rest of the app is (isActive:true on items/rooms) so the assistant never
// reports on soft-deleted items or rooms as if they were live.
import { prisma } from "@/lib/db";

function serializeItemWithRooms(item) {
  const perRoom = item.inventory
    .filter((row) => row.room.isActive)
    .slice()
    .sort((a, b) => a.room.code.localeCompare(b.room.code))
    .map((row) => ({
      roomCode: row.room.code,
      roomName: row.room.name,
      quantity: row.quantity,
    }));
  const totalQuantity = perRoom.reduce((sum, r) => sum + r.quantity, 0);
  return {
    id: item.id,
    name: item.name,
    sku: item.sku,
    unit: item.unit,
    category: item.category?.name || null,
    supplier: item.supplier?.name || null,
    totalQuantity,
    perRoom,
  };
}

async function resolveRoom(roomCode) {
  if (!roomCode) return null;
  const room = await prisma.storageRoom.findFirst({
    where: {
      isActive: true,
      OR: [
        { code: { equals: roomCode, mode: "insensitive" } },
        { name: { contains: roomCode, mode: "insensitive" } },
      ],
    },
  });
  return room;
}

export const TOOL_DEFINITIONS = [
  {
    name: "search_items",
    description:
      "Search the item catalog by name, SKU, or barcode (partial match, case-insensitive). Returns each matching item's total quantity and its quantity in every room. Use this for any question about a specific item or product, including questions in Arabic — translate the item description to its likely English catalog term first, since the catalog is stored in English.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search text, e.g. an item name, part of a name, SKU, or barcode." },
      },
      required: ["query"],
    },
  },
  {
    name: "get_items_by_category",
    description: "List active items in a given category, with their total quantity across all rooms.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Category name (or partial name), e.g. \"Giveaways\", \"Catering\"." },
      },
      required: ["category"],
    },
  },
  {
    name: "list_rooms",
    description: "List every active storage room with its code, name, location, item count, total units, and how many item/room combinations are currently low on stock.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_room_summary",
    description: "Get the full inventory list for one room (every active item stocked there, with quantity and low-stock status).",
    input_schema: {
      type: "object",
      properties: {
        roomCode: { type: "string", description: "Room code or name, e.g. \"PR\", \"Catering\", \"Ground Floor\"." },
      },
      required: ["roomCode"],
    },
  },
  {
    name: "get_low_stock",
    description: "List items currently at or below their low-stock threshold, optionally scoped to one room.",
    input_schema: {
      type: "object",
      properties: {
        roomCode: { type: "string", description: "Optional room code/name to scope the results to a single room." },
      },
    },
  },
  {
    name: "get_out_of_stock",
    description: "List item/room combinations that are at zero quantity, optionally scoped to one room.",
    input_schema: {
      type: "object",
      properties: {
        roomCode: { type: "string", description: "Optional room code/name to scope the results to a single room." },
      },
    },
  },
  {
    name: "get_recent_movements",
    description: "List recent stock movements (additions, removals, transfers, adjustments), most recent first. Can be filtered by item search text and/or room.",
    input_schema: {
      type: "object",
      properties: {
        itemQuery: { type: "string", description: "Optional text to filter by item name/SKU." },
        roomCode: { type: "string", description: "Optional room code/name — matches movements into or out of that room." },
        limit: { type: "integer", description: "Max rows to return, default 15, max 50." },
      },
    },
  },
  {
    name: "list_categories_and_suppliers",
    description: "List every category and every supplier currently in the catalog.",
    input_schema: { type: "object", properties: {} },
  },
];

export async function runTool(name, input) {
  switch (name) {
    case "search_items": {
      const clean = (input?.query || "").trim();
      if (!clean) return { error: "query is required" };
      const items = await prisma.item.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: clean, mode: "insensitive" } },
            { sku: { contains: clean, mode: "insensitive" } },
            { barcode: { contains: clean, mode: "insensitive" } },
          ],
        },
        include: {
          inventory: { include: { room: true } },
          category: true,
          supplier: true,
        },
        orderBy: { name: "asc" },
        take: 15,
      });
      return { items: items.map(serializeItemWithRooms) };
    }

    case "get_items_by_category": {
      const clean = (input?.category || "").trim();
      if (!clean) return { error: "category is required" };
      const items = await prisma.item.findMany({
        where: {
          isActive: true,
          category: { name: { contains: clean, mode: "insensitive" } },
        },
        include: { inventory: { include: { room: true } }, category: true, supplier: true },
        orderBy: { name: "asc" },
        take: 30,
      });
      return { items: items.map(serializeItemWithRooms) };
    }

    case "list_rooms": {
      const rooms = await prisma.storageRoom.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      });
      const results = [];
      for (const room of rooms) {
        const inventory = await prisma.inventoryByRoom.findMany({
          where: { roomId: room.id, item: { isActive: true } },
        });
        const lowStockCount = await prisma.alert.count({
          where: { roomId: room.id, isResolved: false, item: { isActive: true } },
        });
        results.push({
          code: room.code,
          name: room.name,
          location: room.location,
          itemCount: inventory.length,
          totalUnits: inventory.reduce((sum, r) => sum + r.quantity, 0),
          lowStockCount,
        });
      }
      return { rooms: results };
    }

    case "get_room_summary": {
      const room = await resolveRoom(input?.roomCode);
      if (!room) return { error: `No room found matching "${input?.roomCode}"` };
      const rows = await prisma.inventoryByRoom.findMany({
        where: { roomId: room.id, item: { isActive: true } },
        include: { item: { include: { category: true } } },
        orderBy: { item: { name: "asc" } },
      });
      const items = rows.map((row) => {
        const minStockLevel = row.minStockLevel ?? row.item.defaultMinStockLevel;
        return {
          name: row.item.name,
          sku: row.item.sku,
          category: row.item.category?.name || null,
          quantity: row.quantity,
          unit: row.item.unit,
          isLowStock: row.quantity <= minStockLevel,
        };
      });
      return { room: { code: room.code, name: room.name, location: room.location }, items };
    }

    case "get_low_stock": {
      const room = await resolveRoom(input?.roomCode);
      if (input?.roomCode && !room) return { error: `No room found matching "${input.roomCode}"` };
      const alerts = await prisma.alert.findMany({
        where: {
          isResolved: false,
          item: { isActive: true },
          ...(room ? { roomId: room.id } : {}),
        },
        include: { item: true, room: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return {
        alerts: alerts.map((a) => ({
          item: a.item.name,
          sku: a.item.sku,
          roomCode: a.room.code,
          type: a.type,
          message: a.message,
        })),
      };
    }

    case "get_out_of_stock": {
      const room = await resolveRoom(input?.roomCode);
      if (input?.roomCode && !room) return { error: `No room found matching "${input.roomCode}"` };
      const rows = await prisma.inventoryByRoom.findMany({
        where: {
          quantity: 0,
          item: { isActive: true },
          ...(room ? { roomId: room.id } : {}),
        },
        include: { item: true, room: true },
        take: 50,
      });
      return {
        outOfStock: rows.map((r) => ({ item: r.item.name, sku: r.item.sku, roomCode: r.room.code })),
      };
    }

    case "get_recent_movements": {
      const room = await resolveRoom(input?.roomCode);
      if (input?.roomCode && !room) return { error: `No room found matching "${input.roomCode}"` };
      const limit = Math.min(Math.max(Number(input?.limit) || 15, 1), 50);
      const itemQuery = (input?.itemQuery || "").trim();
      const movements = await prisma.stockMovement.findMany({
        where: {
          ...(itemQuery
            ? { item: { OR: [{ name: { contains: itemQuery, mode: "insensitive" } }, { sku: { contains: itemQuery, mode: "insensitive" } }] } }
            : {}),
          ...(room ? { OR: [{ fromRoomId: room.id }, { toRoomId: room.id }] } : {}),
        },
        include: { item: true, fromRoom: true, toRoom: true, user: true },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return {
        movements: movements.map((m) => ({
          date: m.createdAt.toISOString(),
          type: m.type,
          item: m.item.name,
          quantity: m.quantity,
          fromRoom: m.fromRoom?.code || null,
          toRoom: m.toRoom?.code || null,
          user: m.user?.name || null,
          note: m.note || null,
        })),
      };
    }

    case "list_categories_and_suppliers": {
      const [categories, suppliers] = await Promise.all([
        prisma.category.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
        prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
      ]);
      return {
        categories: categories.map((c) => c.name),
        suppliers: suppliers.map((s) => s.name),
      };
    }

    default:
      return { error: `Unknown tool "${name}"` };
  }
}
