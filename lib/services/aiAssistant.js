// LLM-powered assistant, built on tool-use / function calling against an
// OpenAI-compatible chat completions endpoint (default: NVIDIA's hosted
// "moonshotai/kimi-k3" model via https://integrate.api.nvidia.com). The
// model never touches the database directly — every fact it states has to
// come from calling one of the read-only tools in assistantTools.js, so it
// can't invent stock numbers. It can, however, understand free-form
// questions in any language (English, Arabic, or a mix), translate an
// Arabic item description into the catalog's English term itself, and
// reason across multiple tool calls (e.g. "compare low stock between
// Catering and PR" needs two get_low_stock calls).
//
// Falls back to the free local rule-based assistant (lib/assistant.js) if
// NVIDIA_API_KEY isn't set, or if the API call fails for any reason — the
// chat panel should never just break because a key is missing, the
// endpoint is briefly down, or the model doesn't support tool calling the
// way we expect.
import { TOOL_DEFINITIONS, runTool } from "@/lib/services/assistantTools";
import { answerQuery as answerQueryLocally } from "@/lib/assistant";

const API_BASE = process.env.NVIDIA_API_BASE_URL || "https://integrate.api.nvidia.com/v1";
const MODEL = process.env.NVIDIA_ASSISTANT_MODEL || "moonshotai/kimi-k3";
const MAX_TOOL_ROUNDS = 4;

const SUGGESTIONS_EN = [
  "How many paper towels do we have?",
  "What's low in Storage Room 2?",
  "Where is printer toner?",
  "What's out of stock?",
];
const SUGGESTIONS_AR = [
  "كم عدد مناشف الورق لدينا؟",
  "ما هو المخزون المنخفض في غرفة التخزين 2؟",
  "أين يوجد حبر الطابعة؟",
  "ما الذي نفد من المخزون؟",
];

// OpenAI-style function-calling wrapper around the same provider-agnostic
// tool definitions/runner used by the Anthropic-shaped code path.
const OPENAI_TOOLS = TOOL_DEFINITIONS.map((t) => ({
  type: "function",
  function: {
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
  },
}));

function systemPrompt(locale) {
  return `You are the inventory assistant embedded inside a multi-room warehouse/inventory management app. You answer questions about stock levels, item locations, low-stock/out-of-stock status, categories, suppliers, and recent stock movement history.

Rules:
- You MUST call a tool to look up any factual data (quantities, room names, categories, movement history, etc.) before answering. Never state a number or fact you did not get from a tool result. If a tool returns no results, say so plainly instead of guessing.
- The item catalog itself (item names, categories, SKUs) is stored in English, even though users may ask in Arabic. If the user asks in Arabic, translate the item/category they're asking about into its likely English catalog term yourself before calling search_items — don't ask the user to translate it themselves.
- Reply in the same language the user wrote their question in (Arabic question -> Arabic answer, English question -> English answer). The app's current UI language is ${locale === "ar" ? "Arabic" : "English"} — if the user's question is ambiguous or very short, default to that language.
- Be concise and concrete: name the actual items, quantities, and room codes/names involved rather than vague summaries.
- You can only answer questions — you cannot add, remove, transfer, or adjust stock, and you cannot edit or delete anything. If asked to perform an action rather than answer a question, explain that changes need to be made from the relevant page in the app (Items, Stock actions, etc.), not through chat.
- Numbers should use standard Western digits even when replying in Arabic (this matches how the rest of the app displays numbers).`;
}

function extractItemsForUi(toolResults) {
  // Flatten whichever tool results carry item-shaped objects, so the chat
  // panel can keep showing clickable item cards exactly like the old
  // rule-based assistant did — the frontend contract doesn't change.
  const items = [];
  for (const r of toolResults) {
    if (Array.isArray(r?.items)) items.push(...r.items);
  }
  const bySku = new Map();
  for (const it of items) {
    if (it?.sku && !bySku.has(it.sku)) bySku.set(it.sku, it);
  }
  return Array.from(bySku.values()).slice(0, 10);
}

// The stored API key value sometimes already includes a literal "Bearer "
// prefix (e.g. pasted straight from a provider's example curl command). If
// we blindly prepend our own "Bearer " on top of that, the header becomes
// "Bearer Bearer nvapi-..." which the endpoint rejects outright. Strip any
// existing prefix (case-insensitive, tolerant of extra whitespace) before
// building the real header so this works regardless of how the key is
// stored.
function normalizeApiKey(rawKey) {
  return String(rawKey || "").trim().replace(/^bearer\s+/i, "").trim();
}

async function callChatCompletions(apiKey, messages, { withTools = true } = {}) {
  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${normalizeApiKey(apiKey)}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: 1024,
      temperature: 0.3,
      stream: false,
      ...(withTools ? { tools: OPENAI_TOOLS, tool_choice: "auto" } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI endpoint returned ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

export async function answerQueryWithAI(q, { locale = "en" } = {}) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!normalizeApiKey(apiKey)) {
    return answerQueryLocally(q);
  }

  const messages = [
    { role: "system", content: systemPrompt(locale) },
    { role: "user", content: q },
  ];
  const collectedToolResults = [];

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const data = await callChatCompletions(apiKey, messages);
      const message = data?.choices?.[0]?.message;
      if (!message) throw new Error("AI endpoint returned no message");

      const toolCalls = message.tool_calls;
      if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
        const answer = (message.content || "").trim();
        return {
          answer: answer || (locale === "ar" ? "لم أتمكن من إيجاد إجابة." : "I couldn't come up with an answer."),
          items: extractItemsForUi(collectedToolResults),
          suggestions: locale === "ar" ? SUGGESTIONS_AR : SUGGESTIONS_EN,
        };
      }

      messages.push({ role: "assistant", content: message.content || null, tool_calls: toolCalls });

      for (const call of toolCalls) {
        let input = {};
        try {
          input = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
        } catch {
          input = {};
        }
        let result;
        try {
          result = await runTool(call.function?.name, input);
        } catch (err) {
          result = { error: err.message || "Tool call failed" };
        }
        collectedToolResults.push(result);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    // Ran out of tool-call rounds without a final answer — ask once more
    // without tools, forcing a text reply with whatever it has so far.
    const data = await callChatCompletions(apiKey, messages, { withTools: false });
    const answer = (data?.choices?.[0]?.message?.content || "").trim();
    return {
      answer: answer || (locale === "ar" ? "لم أتمكن من إيجاد إجابة." : "I couldn't come up with an answer."),
      items: extractItemsForUi(collectedToolResults),
      suggestions: locale === "ar" ? SUGGESTIONS_AR : SUGGESTIONS_EN,
    };
  } catch (err) {
    console.error("AI assistant call failed, falling back to local assistant:", err);
    return answerQueryLocally(q);
  }
}
