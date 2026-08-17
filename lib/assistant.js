// Rule-based, fully local "smart search" / assistant. Pure regex + keyword
// intent parsing over Prisma queries — no network calls, no LLM.
import { prisma } from "@/lib/db";

const SUGGESTIONS = [
  "How many paper towels do we have?",
  "What's low in Storage Room 2?",
  "Where is printer toner?",
  "What's out of stock?",
];

function extractRoomNumber(text) {
  const match = text.match(/room\s*#?\s*(\d+)/i);
  return match ? match[1] : null;
}

async function findItemsByTerm(term, take = 10) {
  const clean = (term || "").trim();
  if (!clean) return [];
  return prisma.item.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: clean, mode: "insensitive" } },
        { sku: { contains: clean, mode: "insensitive" } },
        { barcode: { contains: clean, mode: "insensitive" } },
      ],
    },
    include: { inventory: { include: { room: true } }, category: true },
    orderBy: { name: "asc" },
    take,
  });
}

function serializeItemWithRooms(item) {
  const perRoom = item.inventory
    .slice()
    .sort((a, b) => a.room.code.localeCompare(b.room.code))
    .map((row) => ({
      roomId: row.roomId,
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
    totalQuantity,
    perRoom,
  };
}

// --- Intent handlers -----------------------------------------------------

async function handleTotal(term) {
  const items = await findItemsByTerm(term);
  if (items.length === 0) {
    return {
      answer: `I couldn't find any item matching "${term}".`,
      items: [],
      suggestions: SUGGESTIONS,
    };
  }
  const serialized = items.map(serializeItemWithRooms);
  if (serialized.length === 1) {
    const it = serialized[0];
    return {
      answer: `You have ${it.totalQuantity} ${it.unit} of ${it.name} across all rooms.`,
      items: serialized,
      suggestions: SUGGESTIONS,
    };
  }
  return {
    answer: `Found ${serialized.length} items matching "${term}". Totals: ${serialized
      .map((it) => `${it.name}: ${it.totalQuantity} ${it.unit}`)
      .join(", ")}.`,
    items: serialized,
    suggestions: SUGGESTIONS,
  };
}

async function handleLowStock(lower) {
  const roomNum = extractRoomNumber(lower);

  if (roomNum) {
    const code = `ROOM${roomNum}`;
    const room = await prisma.storageRoom.findUnique({ where: { code } });
    if (!room) {
      return {
        answer: `I couldn't find a room matching "${code}".`,
        items: [],
        suggestions: SUGGESTIONS,
      };
    }
    const alerts = await prisma.alert.findMany({
      where: { roomId: room.id, isResolved: false },
      include: { item: true },
    });
    const items = alerts.map((a) => ({
      id: a.item.id,
      name: a.item.name,
      sku: a.item.sku,
      type: a.type,
      message: a.message,
    }));
    return {
      answer: alerts.length
        ? `${alerts.length} item(s) are low on stock in ${room.name}: ${items
            .map((i) => i.name)
            .join(", ")}.`
        : `Nothing is currently low on stock in ${room.name}.`,
      items,
      suggestions: SUGGESTIONS,
    };
  }

  const alerts = await prisma.alert.findMany({
    where: { isResolved: false },
    include: { item: true, room: true },
    orderBy: { createdAt: "desc" },
  });
  const items = alerts.map((a) => ({
    id: a.item.id,
    name: a.item.name,
    sku: a.item.sku,
    roomCode: a.room.code,
    type: a.type,
    message: a.message,
  }));
  return {
    answer: alerts.length
      ? `${alerts.length} item/room combination(s) are currently low on stock.`
      : "Nothing is currently low on stock in any room.",
    items,
    suggestions: SUGGESTIONS,
  };
}

async function handleWhereIs(term) {
  const items = await findItemsByTerm(term, 5);
  if (items.length === 0) {
    return {
      answer: `I couldn't find any item matching "${term}".`,
      items: [],
      suggestions: SUGGESTIONS,
    };
  }
  const serialized = items.map(serializeItemWithRooms);
  const it = serialized[0];
  const locations = it.perRoom.filter((r) => r.quantity > 0);
  const answer = locations.length
    ? `${it.name} is in: ${locations.map((r) => `${r.roomCode} (${r.quantity} ${it.unit})`).join(", ")}.`
    : `${it.name} isn't currently stocked in any room.`;
  return { answer, items: serialized, suggestions: SUGGESTIONS };
}

async function handleOutOfStock() {
  const rows = await prisma.inventoryByRoom.findMany({
    where: { quantity: 0 },
    include: { item: true, room: true },
  });
  const activeRows = rows.filter((r) => r.item.isActive);
  const items = activeRows.map((r) => ({
    id: r.item.id,
    name: r.item.name,
    sku: r.item.sku,
    roomCode: r.room.code,
  }));
  return {
    answer: activeRows.length
      ? `${activeRows.length} item/room combination(s) are out of stock: ${items
          .map((i) => `${i.name} (${i.roomCode})`)
          .join(", ")}.`
      : "Nothing is currently out of stock.",
    items,
    suggestions: SUGGESTIONS,
  };
}

async function handleFallback(text) {
  const items = await findItemsByTerm(text);
  const serialized = items.map(serializeItemWithRooms);
  return {
    answer: serialized.length
      ? `Found ${serialized.length} item(s) matching "${text}".`
      : `I couldn't find anything matching "${text}". Try a different search term, or ask "where is X", "how many X", "low stock in room N", or "what's out of stock".`,
    items: serialized,
    suggestions: SUGGESTIONS,
  };
}

// --- Main entry point ------------------------------------------------

export async function answerQuery(q) {
  const text = (q || "").trim();
  const lower = text.toLowerCase();

  if (!text) {
    return {
      answer:
        "Ask me about stock totals, low-stock rooms, item locations, or out-of-stock items.",
      items: [],
      suggestions: SUGGESTIONS,
    };
  }

  // "what's out of stock" / "out of stock items"
  if (/out[\s-]of[\s-]stock/.test(lower)) {
    return handleOutOfStock();
  }

  // "low stock in room 2" / "what's low in storage room 3" / "low stock"
  if (/\blow\b/.test(lower) && (/stock/.test(lower) || /room/.test(lower))) {
    return handleLowStock(lower);
  }

  // "how many <item> do we have" / "total <item>" / "total of <item>"
  let match = lower.match(/(?:how many|how much)\s+(.+?)\s+(?:do we have|are there|in stock)\b/);
  if (!match) match = lower.match(/(?:how many|how much)\s+(.+?)\??$/);
  if (!match) match = lower.match(/total(?:\s+(?:of|for))?\s+(.+?)\??$/);
  if (match && match[1]) {
    return handleTotal(match[1].trim());
  }

  // "where is <item>" / "where's <item>" / "which room(s) has/have <item>"
  match = lower.match(/(?:where\s+is|where'?s|which rooms?\s+(?:has|have))\s+(.+?)\??$/);
  if (match && match[1]) {
    return handleWhereIs(match[1].trim());
  }

  // Fallback: fuzzy substring search over name/sku/barcode.
  return handleFallback(text);
}
