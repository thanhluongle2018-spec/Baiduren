import {
  airports,
  getAirportBySlug,
} from "@/lib/demo-data";
import { mapAirportDetail, mapAirportSummary } from "@/lib/data/mappers";
import { airportScope, loadDatabaseOrDemo } from "@/lib/data/source";
import { getPrisma } from "@/lib/prisma";
import type { AirportDetail, AirportSummary } from "@/types";
import type { LoadedData } from "@/lib/data/source";

const airportInclude = {
  category: true,
  plans: { orderBy: { price: "asc" as const } },
  nodes: { orderBy: { name: "asc" as const } },
  speedTests: {
    where: { status: "COMPLETED" as const, result: { isNot: null } },
    orderBy: { finishedAt: "desc" as const },
    include: {
      result: true,
      node: true,
      server: true,
      airport: { select: { name: true, slug: true } },
    },
  },
  reviews: {
    where: { status: "PUBLISHED" as const },
    orderBy: { createdAt: "desc" as const },
  },
  promotions: true,
};

export async function listAirports(): Promise<LoadedData<AirportSummary[]>> {
  return loadDatabaseOrDemo(async (prisma) => {
    const where = await airportScope(prisma);
    const rows = await prisma.airport.findMany({
      where,
      include: { category: true },
      orderBy: { name: "asc" },
    });
    return rows.map(mapAirportSummary);
  }, airports);
}

export async function getAirportDetail(
  slug: string
): Promise<LoadedData<AirportDetail | undefined>> {
  const fallback = getAirportBySlug(slug);
  try {
    const prisma = getPrisma();
    const where = await airportScope(prisma);
    const formalCount = await prisma.airport.count({
      where: { isDemo: false },
    });
    const row = await prisma.airport.findFirst({
      where: { slug, ...where },
      include: airportInclude,
    });
    if (row) {
      return {
        demo: formalCount === 0,
        source: "database",
        data: mapAirportDetail(row),
      };
    }
    const total = await prisma.airport.count();
    if (total > 0) {
      return {
        demo: formalCount === 0,
        source: "database",
        data: undefined,
      };
    }
    return { demo: true, source: "demo", data: fallback };
  } catch {
    return { demo: true, source: "demo", data: fallback };
  }
}
