import { NextResponse } from "next/server";
import { reviews } from "@/lib/demo-data";
import type { ApiListResponse } from "@/types/api";
import type { ReviewRecord } from "@/types";

export function GET() {
  const body: ApiListResponse<ReviewRecord[]> = {
    demo: true,
    source: "demo",
    generatedAt: new Date().toISOString(),
    data: reviews,
  };
  return NextResponse.json(body);
}
