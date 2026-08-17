import { NextResponse } from "next/server";
import { getSession, requireRole, errorResponse, ApiError } from "@/lib/auth";
import { answerQuery } from "@/lib/assistant";

export async function POST(request) {
  try {
    const session = getSession(request);
    requireRole(session); // VIEWER+ can use the assistant/search

    const body = await request.json().catch(() => ({}));
    const q = body?.q;
    if (typeof q !== "string") {
      throw new ApiError(400, "q is required");
    }

    const result = await answerQuery(q);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
