import { NextResponse } from "next/server";
import { requireRole, errorResponse, ApiError } from "@/lib/auth";
import { answerQueryWithAI } from "@/lib/services/aiAssistant";

export async function POST(request) {
  try {
    const session = await requireRole(request); // VIEWER+ can use the assistant/search

    const body = await request.json().catch(() => ({}));
    const q = body?.q;
    if (typeof q !== "string") {
      throw new ApiError(400, "q is required");
    }

    // Locale drives which language the AI assistant replies in when the
    // question itself is ambiguous — same cookie the rest of the app uses
    // (see components/LocaleContext.jsx), read directly here since this is
    // a plain POST route rather than a page.
    const locale = request.cookies.get("locale")?.value === "ar" ? "ar" : "en";

    const result = await answerQueryWithAI(q, { locale });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
