import { rankingRows } from "@/lib/demo-data";
import { cheapestPlanLabel, mapPlan } from "@/lib/data/mappers";
import {
  airportScope,
  loadDatabaseOrDemo,
  logoTextFromName,
  toIso,
  toNumber,
} from "@/lib/data/source";
import type { RankingRow } from "@/types";
import type { LoadedData } from "@/lib/data/source";

export async function getAirportRanking(): Promise<LoadedData<RankingRow[]>> {
  return loadDatabaseOrDemo(async (prisma) => {
    const where = await airportScope(prisma);
    const airports = await prisma.airport.findMany({
      where,
      include: {
        plans: { where: { status: "ACTIVE" } },
        speedTests: {
          where: { status: "COMPLETED", result: { isNot: null } },
          include: { result: true },
        },
      },
    });

    if (airports.length === 0) return [];

    const rows = airports.map((airport) => {
      const results = airport.speedTests
        .map((test) => test.result)
        .filter(
          (result): result is NonNullable<(typeof airport.speedTests)[number]["result"]> =>
            result != null
        );
      const count = results.length || 1;
      const avg = (pick: (item: NonNullable<(typeof results)[number]>) => number) =>
        results.length === 0
          ? 0
          : results.reduce((sum, item) => sum + pick(item), 0) / count;
      const latest = airport.speedTests
        .map((test) => test.finishedAt ?? test.result?.testedAt ?? airport.updatedAt)
        .sort((a, b) => +new Date(b) - +new Date(a))[0];

      return {
        rank: 0,
        airportId: airport.id,
        slug: airport.slug,
        name: airport.name,
        logoText: logoTextFromName(airport.name),
        score: toNumber(airport.score),
        latencyMs: avg((item) => toNumber(item.latencyMs)),
        downloadMbps: avg((item) => toNumber(item.downloadMbps)),
        uploadMbps: avg((item) => toNumber(item.uploadMbps)),
        packetLoss: avg((item) => toNumber(item.packetLoss)),
        successRate: avg((item) => toNumber(item.successRate)),
        stability: avg((item) => toNumber(item.stability)),
        priceLabel: cheapestPlanLabel(airport.plans.map(mapPlan)),
        updatedAt: toIso(latest),
      };
    });

    return rows
      .sort((a, b) => b.downloadMbps - a.downloadMbps)
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }, rankingRows);
}

export async function getRankingPreview(
  limit = 5
): Promise<LoadedData<RankingRow[]>> {
  const payload = await getAirportRanking();
  return { ...payload, data: payload.data.slice(0, limit) };
}
