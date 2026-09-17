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

const extraNodes = [
  {
    id: "node_dukou_sg",
    airportId: "ap_dukou",
    name: "新加坡 02",
    region: "新加坡",
    kind: "中转",
    status: "ACTIVE" as const,
  },
  {
    id: "node_beian_hk",
    airportId: "ap_beian",
    name: "香港 02",
    region: "香港",
    kind: "中转",
    status: "ACTIVE" as const,
  },
  {
    id: "node_dengta_jp",
    airportId: "ap_dengta",
    name: "东京 02",
    region: "东京",
    kind: "直连",
    status: "ACTIVE" as const,
  },
  {
    id: "node_qingzhou_sg",
    airportId: "ap_qingzhou",
    name: "新加坡 02",
    region: "新加坡",
    kind: "中转",
    status: "ACTIVE" as const,
  },
  {
    id: "node_chenfeng_jp",
    airportId: "ap_chenfeng",
    name: "东京 02",
    region: "东京",
    kind: "中转",
    status: "ACTIVE" as const,
  },
];

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
        isDemo: true,
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
        isDemo: true,
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
        description: "演示套餐，非正式售卖。",
        deviceLimit: plan.deviceLimit,
        features: plan.features,
        status: plan.status,
        isDemo: true,
      },
      create: {
        id: plan.id,
        airportId: plan.airportId,
        name: plan.name,
        price: plan.price,
        currency: plan.currency,
        billingCycle: plan.billingCycle,
        trafficGb: plan.trafficGb,
        description: "演示套餐，非正式售卖。",
        deviceLimit: plan.deviceLimit,
        features: plan.features,
        status: plan.status,
        isDemo: true,
      },
    });
  }

  for (const node of [...nodes, ...extraNodes]) {
    await prisma.node.upsert({
      where: { id: node.id },
      update: {
        name: node.name,
        region: node.region,
        kind: node.kind,
        status: node.status,
        isDemo: true,
      },
      create: {
        id: node.id,
        airportId: node.airportId,
        name: node.name,
        region: node.region,
        kind: node.kind,
        status: node.status,
        isDemo: true,
      },
    });
  }

  const shanghai = await prisma.speedTestServer.upsert({
    where: { id: "srv_demo_shanghai" },
    update: { name: "演示测速点 · 上海", region: "上海", status: "DRAFT" },
    create: {
      id: "srv_demo_shanghai",
      name: "演示测速点 · 上海",
      region: "上海",
      status: "DRAFT",
    },
  });

  const guangzhou = await prisma.speedTestServer.upsert({
    where: { id: "srv_demo_guangzhou" },
    update: { name: "演示测速点 · 广州", region: "广州", status: "DRAFT" },
    create: {
      id: "srv_demo_guangzhou",
      name: "演示测速点 · 广州",
      region: "广州",
      status: "DRAFT",
    },
  });

  for (const test of speedTests) {
    const serverId = test.region === "广州" ? guangzhou.id : shanghai.id;
    await prisma.speedTest.upsert({
      where: { id: test.id },
      update: {
        status: test.status,
        mode: test.mode,
        region: test.region,
        startedAt: test.startedAt,
        finishedAt: test.finishedAt,
        isDemo: true,
        serverId,
      },
      create: {
        id: test.id,
        airportId: test.airportId,
        nodeId: test.nodeId,
        serverId,
        status: test.status,
        mode: test.mode,
        region: test.region,
        startedAt: test.startedAt,
        finishedAt: test.finishedAt,
        isDemo: true,
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
        singleThread: test.mode === "SINGLE_THREAD",
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
        singleThread: test.mode === "SINGLE_THREAD",
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
        isDemo: true,
      },
      create: {
        id: review.id,
        airportId: review.airportId,
        rating: review.rating,
        title: review.title,
        content: review.content,
        status: review.status,
        isDemo: true,
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
        clickCount: 0,
        enabled: false,
        isDemo: true,
      },
      create: {
        id: promotion.id,
        airportId: promotion.airportId,
        name: promotion.name,
        affiliateUrl: promotion.affiliateUrl,
        couponCode: promotion.couponCode,
        status: promotion.status,
        clickCount: 0,
        enabled: false,
        isDemo: true,
      },
    });
  }

  for (const announcement of announcements) {
    await prisma.announcement.upsert({
      where: { id: announcement.id },
      update: {
        title: "第二阶段：数据库演示 seed",
        content:
          "当前库内记录均为明确标记的演示数据（isDemo=true）。清空数据库后，网站会回退到内存演示数据。",
        status: announcement.status,
        publishedAt: announcement.publishedAt,
        isDemo: true,
      },
      create: {
        id: announcement.id,
        title: "第二阶段：数据库演示 seed",
        content:
          "当前库内记录均为明确标记的演示数据（isDemo=true）。清空数据库后，网站会回退到内存演示数据。",
        status: announcement.status,
        publishedAt: announcement.publishedAt,
        isDemo: true,
      },
    });
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
