import { NextResponse } from "next/server";
import { listReviews } from "@/lib/data/content";
import type { ApiListResponse } from "@/types/api";
import type { ReviewRecord } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await listReviews();
  const body: ApiListResponse<ReviewRecord[]> = {
    ...payload,
    generatedAt: new Date().toISOString(),
  };
  return NextResponse.json(body);
}
