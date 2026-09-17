import { NextResponse } from "next/server";
import { listSpeedTests } from "@/lib/data/content";
import { mapSpeedTest } from "@/lib/data/mappers";
import { createSpeedTestJob } from "@/lib/speedtest/jobs";
import { isSpeedTestJobError, SpeedTestJobError } from "@/lib/speedtest/errors";
import type { ApiErrorResponse, ApiListResponse } from "@/types/api";
import type { SpeedTestRecord } from "@/types";

export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number) {
  const body: ApiErrorResponse = { demo: true, error: message };
  return NextResponse.json(body, { status });
}

export async function GET() {
  try {
    const payload = await listSpeedTests();
    const body: ApiListResponse<SpeedTestRecord[]> = {
      ...payload,
      generatedAt: new Date().toISOString(),
    };
    return NextResponse.json(body);
  } catch {
    return errorResponse("无法读取测速任务。", 503);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("请求体必须是 JSON。", 400);
  }

  if (!body || typeof body !== "object") {
    return errorResponse("请求体必须是 JSON 对象。", 400);
  }

  const input = body as Record<string, unknown>;
  if (input.isDemo === false) {
    return errorResponse("当前阶段仅允许创建演示测速任务。", 400);
  }

  const airportId = typeof input.airportId === "string" ? input.airportId : "";
  const nodeId = typeof input.nodeId === "string" ? input.nodeId : "";
  const speedTestServerId =
    typeof input.speedTestServerId === "string"
      ? input.speedTestServerId
      : typeof input.serverId === "string"
        ? input.serverId
        : "";

  if (!airportId || !nodeId || !speedTestServerId) {
    return errorResponse("airportId、nodeId 与 speedTestServerId 为必填项。", 400);
  }

  let concurrency: number | undefined;
  if (input.concurrency != null) {
    const parsed = Number(input.concurrency);
    if (!Number.isInteger(parsed)) {
      return errorResponse("concurrency 必须是 1 到 8 的整数。", 400);
    }
    concurrency = parsed;
  }

  try {
    const job = await createSpeedTestJob({
      airportId,
      nodeId,
      speedTestServerId,
      concurrency,
      isDemo: true,
    });
    return NextResponse.json(
      {
        demo: true,
        source: "database",
        generatedAt: new Date().toISOString(),
        data: mapSpeedTest(job),
      },
      { status: 201 }
    );
  } catch (error) {
    if (isSpeedTestJobError(error) || error instanceof SpeedTestJobError) {
      return errorResponse(error.message, error.status);
    }
    return errorResponse("无法创建测速任务。", 500);
  }
}
