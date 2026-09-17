import { NextResponse } from "next/server";
import { getAirportDetail } from "@/lib/data/airports";
import type { ApiErrorResponse, ApiListResponse } from "@/types/api";
import type { AirportDetail } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const payload = await getAirportDetail(slug);
  if (!payload.data) {
    const body: ApiErrorResponse = {
      demo: payload.demo,
      error: "airport_not_found",
    };
    return NextResponse.json(body, { status: 404 });
  }

  const body: ApiListResponse<AirportDetail> = {
    ...payload,
    data: payload.data,
    generatedAt: new Date().toISOString(),
  };
  return NextResponse.json(body);
}
