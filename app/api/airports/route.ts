import { NextResponse } from "next/server";
import { listAirports } from "@/lib/data/airports";
import type { ApiListResponse } from "@/types/api";
import type { AirportSummary } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await listAirports();
  const body: ApiListResponse<AirportSummary[]> = {
    ...payload,
    generatedAt: new Date().toISOString(),
  };
  return NextResponse.json(body);
}
