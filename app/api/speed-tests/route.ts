import { NextResponse } from "next/server";
import { speedTests } from "@/lib/demo-data";
import type { ApiListResponse } from "@/types/api";
import type { SpeedTestRecord } from "@/types";

export function GET() {
  const body: ApiListResponse<SpeedTestRecord[]> = {
    demo: true,
    source: "demo",
    generatedAt: new Date().toISOString(),
    data: speedTests,
  };
  return NextResponse.json(body);
}
