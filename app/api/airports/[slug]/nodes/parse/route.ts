import { NextResponse } from "next/server";
import { isSubscriptionError, SubscriptionError } from "@/lib/subscription/errors";
import { parseAndImportAirportNodes } from "@/lib/subscription/import-nodes";
import type { ApiErrorResponse } from "@/types/api";

export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number) {
  const body: ApiErrorResponse = { demo: true, error: message };
  return NextResponse.json(body, { status });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("请求体必须是 JSON。", 400);
  }

  if (!body || typeof body !== "object") {
    return errorResponse("请求体必须是 JSON 对象。", 400);
  }

  const content = (body as Record<string, unknown>).content;
  if (typeof content !== "string") {
    return errorResponse("请提供订阅内容。", 400);
  }

  try {
    const result = await parseAndImportAirportNodes(slug, content);
    return NextResponse.json({
      demo: result.airportIsDemo,
      source: "database",
      generatedAt: new Date().toISOString(),
      data: {
        parsedCount: result.parsedCount,
        unsupportedCount: result.unsupportedCount,
        invalidCount: result.invalidCount,
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        deactivatedCount: result.deactivatedCount,
        nodes: result.nodes,
        unsupported: result.unsupported,
        invalid: result.invalid,
      },
    });
  } catch (error) {
    if (isSubscriptionError(error) || error instanceof SubscriptionError) {
      return errorResponse(error.message, error.status);
    }
    return errorResponse("无法解析订阅内容。", 500);
  }
}
