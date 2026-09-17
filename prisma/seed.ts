import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import {
  announcements,
  airports,
  categories,
  nodes,
  plans,
  promotions,
  reviews,
  speedTests,
} from "../lib/demo-data";

function getClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return new PrismaClient({
    adapter: new PrismaPg(url),
  });
}

async function main() {
  const prisma = getClient();

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
      },
      create: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
      },
    });
  }

  for (const airport of airports) {
    const category = categories.find((item) => item.slug === airport.categorySlug);
    await prisma.airport.upsert({
      where: { slug: airport.slug },
      update: {
        name: airport.name,
        summary: airport.summary,
        description: airport.description,
        websiteUrl: airport.websiteUrl,
        status: airport.status,
        score: airport.score,
        categoryId: category?.id,
      },
      create: {
        id: airport.id,
        name: airport.name,
        slug: airport.slug,
        summary: airport.summary,
        description: airport.description,
        websiteUrl: airport.websiteUrl,
        status: airport.status,
        score: airport.score,
        categoryId: category?.id,
      },
    });
  }

  for (const plan of plans) {
    await prisma.airportPlan.upsert({
      where: { id: plan.id },
      update: {
        name: plan.name,
        price: plan.price,
        billingCycle: plan.billingCycle,
        trafficGb: plan.trafficGb,
        deviceLimit: plan.deviceLimit,
        features: plan.features,
        status: plan.status,
      },
      create: {
        id: plan.id,
        airportId: plan.airportId,
        name: plan.name,
        price: plan.price,
        currency: plan.currency,
        billingCycle: plan.billingCycle,
        trafficGb: plan.trafficGb,
        deviceLimit: plan.deviceLimit,
        features: plan.features,
        status: plan.status,
      },
    });
  }

  for (const node of nodes) {
    await prisma.node.upsert({
      where: { id: node.id },
      update: {
        name: node.name,
        region: node.region,
        kind: node.kind,
        status: node.status,
      },
      create: {
        id: node.id,
        airportId: node.airportId,
        name: node.name,
        region: node.region,
        kind: node.kind,
        status: node.status,
      },
    });
  }

  const demoServer = await prisma.speedTestServer.upsert({
    where: { id: "srv_demo_shanghai" },
    update: { name: "演示测速点 · 上海", region: "上海", status: "DRAFT" },
    create: {
      id: "srv_demo_shanghai",
      name: "演示测速点 · 上海",
      region: "上海",
      status: "DRAFT",
    },
  });

  for (const test of speedTests) {
    await prisma.speedTest.upsert({
      where: { id: test.id },
      update: {
        status: test.status,
        mode: test.mode,
        region: test.region,
        startedAt: test.startedAt,
        finishedAt: test.finishedAt,
      },
      create: {
        id: test.id,
        airportId: test.airportId,
        nodeId: test.nodeId,
        serverId: demoServer.id,
        status: test.status,
        mode: test.mode,
        region: test.region,
        startedAt: test.startedAt,
        finishedAt: test.finishedAt,
      },
    });

    await prisma.speedTestResult.upsert({
      where: { speedTestId: test.id },
      update: {
        latencyMs: test.result.latencyMs,
        downloadMbps: test.result.downloadMbps,
        uploadMbps: test.result.uploadMbps,
        packetLoss: test.result.packetLoss,
        successRate: test.result.successRate,
        stability: test.result.stability,
        testedAt: test.result.testedAt,
      },
      create: {
        speedTestId: test.id,
        latencyMs: test.result.latencyMs,
        downloadMbps: test.result.downloadMbps,
        uploadMbps: test.result.uploadMbps,
        packetLoss: test.result.packetLoss,
        successRate: test.result.successRate,
        stability: test.result.stability,
        testedAt: test.result.testedAt,
      },
    });
  }

  for (const review of reviews) {
    await prisma.review.upsert({
      where: { id: review.id },
      update: {
        rating: review.rating,
        title: review.title,
        content: review.content,
        status: review.status,
      },
      create: {
        id: review.id,
        airportId: review.airportId,
        rating: review.rating,
        title: review.title,
        content: review.content,
        status: review.status,
      },
    });
  }

  for (const promotion of promotions) {
    await prisma.promotion.upsert({
      where: { id: promotion.id },
      update: {
        name: promotion.name,
        affiliateUrl: promotion.affiliateUrl,
        couponCode: promotion.couponCode,
        status: promotion.status,
      },
      create: {
        id: promotion.id,
        airportId: promotion.airportId,
        name: promotion.name,
        affiliateUrl: promotion.affiliateUrl,
        couponCode: promotion.couponCode,
        status: promotion.status,
      },
    });
  }

  for (const announcement of announcements) {
    await prisma.announcement.upsert({
      where: { id: announcement.id },
      update: {
        title: announcement.title,
        content: announcement.content,
        status: announcement.status,
        publishedAt: announcement.publishedAt,
      },
      create: {
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        status: announcement.status,
        publishedAt: announcement.publishedAt,
      },
    });
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
