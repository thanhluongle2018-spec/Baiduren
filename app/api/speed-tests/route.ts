import { NextResponse } from "next/server";
import { listSpeedTests } from "@/lib/data/content";
import type { ApiListResponse } from "@/types/api";
import type { SpeedTestRecord } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await listSpeedTests();
  const body: ApiListResponse<SpeedTestRecord[]> = {
    ...payload,
    generatedAt: new Date().toISOString(),
  };
  return NextResponse.json(body);
}
