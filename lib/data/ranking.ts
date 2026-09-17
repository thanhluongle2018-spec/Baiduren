import { rankingRows } from "@/lib/demo-data";
import { cheapestPlanLabel, mapPlan } from "@/lib/data/mappers";
import {
  airportScope,
  logoTextFromName,
  toIso,
  toNumber,
} from "@/lib/data/source";
import { getPrisma } from "@/lib/prisma";
import { RANKING_WINDOW_MS, SUCCESSFUL_STATUSES } from "@/lib/speedtest/constants";
import type { RankingRow } from "@/types";
import type { LoadedData } from "@/lib/data/source";

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower] ?? 0;
  const weight = index - lower;
  return (sorted[lower] ?? 0) * (1 - weight) + (sorted[upper] ?? 0) * weight;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function getAirportRanking(): Promise<LoadedData<RankingRow[]>> {
  try {
    const prisma = getPrisma();
    const where = await airportScope(prisma);
    const since = new Date(Date.now() - RANKING_WINDOW_MS);
    const airports = await prisma.airport.findMany({
      where,
      include: {
        plans: { where: { status: "ACTIVE" } },
        speedTests: {
          where: {
            status: { in: SUCCESSFUL_STATUSES },
            result: { testedAt: { gte: since } },
          },
          include: { result: true },
        },
      },
    });

    if (airports.length === 0) {
      return { demo: true, source: "demo", data: rankingRows };
    }

    const formalCount = await prisma.airport.count({
      where: { isDemo: false },
    });

    const rows = airports
      .map((airport) => {
        const results = airport.speedTests
          .map((test) => test.result)
          .filter(
            (result): result is NonNullable<(typeof airport.speedTests)[number]["result"]> =>
              result != null
          );
        if (results.length === 0) return null;

        const latencies = results.map((item) => toNumber(item.latencyMs));
        const downloadSingle = results.map((item) =>
          toNumber(item.downloadSingleMbps ?? item.downloadMbps)
        );
        const downloadMulti = results.map((item) =>
          toNumber(item.downloadMultiMbps ?? item.downloadMbps)
        );
        const uploadSingle = results.map((item) =>
          toNumber(item.uploadSingleMbps ?? item.uploadMbps)
        );
        const uploadMulti = results.map((item) =>
          toNumber(item.uploadMultiMbps ?? item.uploadMbps)
        );
        const packetLoss = results.map((item) =>
          toNumber(item.packetLossPercent ?? item.packetLoss)
        );
        const successRate = results.map((item) =>
          toNumber(item.successRatePercent ?? item.successRate)
        );
        const stability = results.map((item) => toNumber(item.stability));
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
          latencyMs: average(latencies),
          p50LatencyMs: percentile(latencies, 0.5),
          downloadMbps: average(downloadMulti),
          downloadSingleMbps: average(downloadSingle),
          downloadMultiMbps: average(downloadMulti),
          uploadMbps: average(uploadMulti),
          uploadSingleMbps: average(uploadSingle),
          uploadMultiMbps: average(uploadMulti),
          packetLoss: average(packetLoss),
          successRate: average(successRate),
          stability: average(stability),
          sampleCount: results.length,
          priceLabel: cheapestPlanLabel(airport.plans.map(mapPlan)),
          updatedAt: toIso(latest),
        } satisfies RankingRow;
      })
      .filter((row): row is RankingRow => row != null)
      .sort((a, b) => b.downloadMbps - a.downloadMbps)
      .map((row, index) => ({ ...row, rank: index + 1 }));

    return {
      demo: formalCount === 0,
      source: "database",
      data: rows,
    };
  } catch {
    return { demo: true, source: "demo", data: rankingRows };
  }
}

export async function getRankingPreview(
  limit = 5
): Promise<LoadedData<RankingRow[]>> {
  const payload = await getAirportRanking();
  return { ...payload, data: payload.data.slice(0, limit) };
}
