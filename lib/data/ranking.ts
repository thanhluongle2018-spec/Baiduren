import { rankingRows } from "@/lib/demo-data";
import type { RankingRow } from "@/types";

/**
 * Ranking is isolated from page components so phase 2 can swap the source:
 * SpeedTestResult (DB) → aggregate → ranking table.
 */
export async function getAirportRanking(): Promise<RankingRow[]> {
  return rankingRows;
}

export async function getRankingPreview(limit = 5): Promise<RankingRow[]> {
  const rows = await getAirportRanking();
  return rows.slice(0, limit);
}
