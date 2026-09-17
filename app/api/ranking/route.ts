import { NextResponse } from "next/server";
import { getAirportRanking } from "@/lib/data/ranking";
import type { ApiListResponse } from "@/types/api";
import type { RankingRow } from "@/types";

export async function GET() {
  const data = await getAirportRanking();
  const body: ApiListResponse<RankingRow[]> = {
    demo: true,
    source: "demo",
    generatedAt: new Date().toISOString(),
    data,
  };
  return NextResponse.json(body);
}
