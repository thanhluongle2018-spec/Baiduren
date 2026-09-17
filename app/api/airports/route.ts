import { NextResponse } from "next/server";
import { listAirports } from "@/lib/data/airports";
import type { ApiListResponse } from "@/types/api";
import type { AirportSummary } from "@/types";

export async function GET() {
  const data = await listAirports();
  const body: ApiListResponse<AirportSummary[]> = {
    demo: true,
    source: "demo",
    generatedAt: new Date().toISOString(),
    data,
  };
  return NextResponse.json(body);
}
