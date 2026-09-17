import { NextResponse } from "next/server";
import { getAirportRanking } from "@/lib/data/ranking";
import type { ApiListResponse } from "@/types/api";
import type { RankingRow } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getAirportRanking();
  const body: ApiListResponse<RankingRow[]> = {
    ...payload,
    generatedAt: new Date().toISOString(),
  };
  return NextResponse.json(body);
}
