import { announcements, promotions, reviews, speedTests } from "@/lib/demo-data";
import {
  mapAnnouncement,
  mapPromotion,
  mapReview,
  mapSpeedTest,
} from "@/lib/data/mappers";
import { airportScope, loadDatabaseOrDemo } from "@/lib/data/source";
import { RECENT_JOB_LIMIT, SUCCESSFUL_STATUSES } from "@/lib/speedtest/constants";
import type { AnnouncementRecord, PromotionRecord, ReviewRecord, SpeedTestRecord } from "@/types";
import type { LoadedData } from "@/lib/data/source";

const speedTestInclude = {
  result: true,
  node: true,
  server: true,
  airport: { select: { name: true, slug: true } },
} as const;

export async function listSpeedTests(): Promise<LoadedData<SpeedTestRecord[]>> {
  return loadDatabaseOrDemo(async (prisma) => {
    const where = await airportScope(prisma);
    const rows = await prisma.speedTest.findMany({
      where: { airport: where },
      orderBy: { createdAt: "desc" },
      take: RECENT_JOB_LIMIT,
      include: speedTestInclude,
    });
    return rows.map(mapSpeedTest);
  }, speedTests);
}

export async function listSuccessfulSpeedTests(): Promise<LoadedData<SpeedTestRecord[]>> {
  return loadDatabaseOrDemo(async (prisma) => {
    const where = await airportScope(prisma);
    const rows = await prisma.speedTest.findMany({
      where: {
        status: { in: SUCCESSFUL_STATUSES },
        result: { isNot: null },
        airport: where,
      },
      orderBy: { finishedAt: "desc" },
      take: RECENT_JOB_LIMIT,
      include: speedTestInclude,
    });
    return rows.map(mapSpeedTest);
  }, speedTests);
}

export async function listReviews(): Promise<LoadedData<ReviewRecord[]>> {
  return loadDatabaseOrDemo(async (prisma) => {
    const where = await airportScope(prisma);
    const rows = await prisma.review.findMany({
      where: { status: "PUBLISHED", airport: where },
      orderBy: { createdAt: "desc" },
      include: { airport: { select: { name: true } } },
    });
    return rows.map(mapReview);
  }, reviews);
}

export async function listAnnouncements(): Promise<LoadedData<AnnouncementRecord[]>> {
  return loadDatabaseOrDemo(async (prisma) => {
    const rows = await prisma.announcement.findMany({
      where: { status: "ACTIVE" },
      orderBy: { publishedAt: "desc" },
    });
    return rows.map(mapAnnouncement);
  }, announcements);
}

export async function listPromotions(): Promise<LoadedData<PromotionRecord[]>> {
  return loadDatabaseOrDemo(async (prisma) => {
    const where = await airportScope(prisma);
    const rows = await prisma.promotion.findMany({
      where: { airport: where },
      orderBy: { createdAt: "desc" },
      include: { airport: { select: { name: true } } },
    });
    return rows.map(mapPromotion);
  }, promotions);
}
