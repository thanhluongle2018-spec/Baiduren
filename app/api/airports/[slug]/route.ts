import { NextResponse } from "next/server";
import { getAirportDetail } from "@/lib/data/airports";
import type { ApiErrorResponse, ApiListResponse } from "@/types/api";
import type { AirportDetail } from "@/types";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const airport = await getAirportDetail(slug);
  if (!airport) {
    const body: ApiErrorResponse = { demo: true, error: "airport_not_found" };
    return NextResponse.json(body, { status: 404 });
  }

  const body: ApiListResponse<AirportDetail> = {
    demo: true,
    source: "demo",
    generatedAt: new Date().toISOString(),
    data: airport,
  };
  return NextResponse.json(body);
}
