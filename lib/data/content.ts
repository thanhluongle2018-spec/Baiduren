import { announcements, promotions, reviews, speedTests } from "@/lib/demo-data";
import {
  mapAnnouncement,
  mapPromotion,
  mapReview,
  mapSpeedTest,
} from "@/lib/data/mappers";
import { airportScope, loadDatabaseOrDemo } from "@/lib/data/source";
import type { AnnouncementRecord, PromotionRecord, ReviewRecord, SpeedTestRecord } from "@/types";
import type { LoadedData } from "@/lib/data/source";

export async function listSpeedTests(): Promise<LoadedData<SpeedTestRecord[]>> {
  return loadDatabaseOrDemo(async (prisma) => {
    const where = await airportScope(prisma);
    const rows = await prisma.speedTest.findMany({
      where: {
        status: "COMPLETED",
        result: { isNot: null },
        airport: where,
      },
      orderBy: { finishedAt: "desc" },
      include: {
        result: true,
        node: true,
        server: true,
        airport: { select: { name: true, slug: true } },
      },
    });
    return rows
      .map(mapSpeedTest)
      .filter((item): item is SpeedTestRecord => item != null);
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
