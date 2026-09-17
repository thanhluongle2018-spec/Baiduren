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

  const legacyShanghai = await prisma.speedTestServer.upsert({
    where: { id: "srv_demo_shanghai" },
    update: {
      name: "演示测速点 · 上海（已停用）",
      region: "上海",
      countryCode: "CN",
      city: "上海",
      bandwidthMbps: 1000,
      maxConcurrentTests: 1,
      status: "DISABLED",
      isDemo: true,
    },
    create: {
      id: "srv_demo_shanghai",
      name: "演示测速点 · 上海（已停用）",
      region: "上海",
      countryCode: "CN",
      city: "上海",
      bandwidthMbps: 1000,
      maxConcurrentTests: 1,
      status: "DISABLED",
      isDemo: true,
    },
  });

  const legacyGuangzhou = await prisma.speedTestServer.upsert({
    where: { id: "srv_demo_guangzhou" },
    update: {
      name: "演示测速点 · 广州（已停用）",
      region: "广州",
      countryCode: "CN",
      city: "广州",
      bandwidthMbps: 1000,
      maxConcurrentTests: 1,
      status: "DISABLED",
      isDemo: true,
    },
    create: {
      id: "srv_demo_guangzhou",
      name: "演示测速点 · 广州（已停用）",
      region: "广州",
      countryCode: "CN",
      city: "广州",
      bandwidthMbps: 1000,
      maxConcurrentTests: 1,
      status: "DISABLED",
      isDemo: true,
    },
  });

  void legacyShanghai;
  void legacyGuangzhou;

  const demoServers = [
    {
      id: "server-cn-demo",
      name: "演示测速服务器 · 中国大陆",
      region: "中国大陆",
      countryCode: "CN",
      city: "上海",
      bandwidthMbps: 1000,
      maxConcurrentTests: 2,
    },
    {
      id: "server-hk-demo",
      name: "演示测速服务器 · 香港",
      region: "香港",
      countryCode: "HK",
      city: "香港",
      bandwidthMbps: 1000,
      maxConcurrentTests: 2,
    },
    {
      id: "server-jp-demo",
      name: "演示测速服务器 · 日本",
      region: "日本",
      countryCode: "JP",
      city: "东京",
      bandwidthMbps: 1000,
      maxConcurrentTests: 2,
    },
    {
      id: "server-us-west-demo",
      name: "演示测速服务器 · 美国西部",
      region: "美国西部",
      countryCode: "US",
      city: "洛杉矶",
      bandwidthMbps: 1000,
      maxConcurrentTests: 2,
    },
  ];

  for (const server of demoServers) {
    await prisma.speedTestServer.upsert({
      where: { id: server.id },
      update: {
        name: server.name,
        region: server.region,
        countryCode: server.countryCode,
        city: server.city,
        bandwidthMbps: server.bandwidthMbps,
        maxConcurrentTests: server.maxConcurrentTests,
        status: "ACTIVE",
        isDemo: true,
        endpoint: null,
      },
      create: {
        ...server,
        status: "ACTIVE",
        isDemo: true,
        endpoint: null,
      },
    });
  }

  const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);

  const seedJobs = [
    {
      test: speedTests[0],
      serverId: "server-hk-demo",
      startedAt: hoursAgo(3),
      finishedAt: hoursAgo(2.9),
    },
    {
      test: speedTests[1],
      serverId: "server-cn-demo",
      startedAt: hoursAgo(5),
      finishedAt: hoursAgo(4.9),
    },
    {
      test: speedTests[2],
      serverId: "server-jp-demo",
      startedAt: hoursAgo(8),
      finishedAt: hoursAgo(7.9),
    },
    {
      test: speedTests[3],
      serverId: "server-us-west-demo",
      startedAt: hoursAgo(11),
      finishedAt: hoursAgo(10.9),
    },
    {
      test: speedTests[4],
      serverId: "server-cn-demo",
      startedAt: hoursAgo(14),
      finishedAt: hoursAgo(13.9),
    },
  ];

  for (const item of seedJobs) {
    const test = item.test;
    if (!test || !test.result) continue;
    await prisma.speedTest.upsert({
      where: { id: test.id },
      update: {
        status: "SUCCESS",
        mode: test.mode,
        concurrency: test.concurrency,
        region: test.region,
        startedAt: item.startedAt,
        finishedAt: item.finishedAt,
        errorMessage: null,
        isDemo: true,
        serverId: item.serverId,
        nodeId: test.nodeId,
      },
      create: {
        id: test.id,
        airportId: test.airportId,
        nodeId: test.nodeId,
        serverId: item.serverId,
        status: "SUCCESS",
        mode: test.mode,
        concurrency: test.concurrency,
        region: test.region,
        startedAt: item.startedAt,
        finishedAt: item.finishedAt,
        isDemo: true,
      },
    });

    await prisma.speedTestResult.upsert({
      where: { speedTestId: test.id },
      update: {
        latencyMs: test.result.latencyMs,
        minLatencyMs: test.result.minLatencyMs,
        maxLatencyMs: test.result.maxLatencyMs,
        downloadMbps: test.result.downloadMbps,
        downloadSingleMbps: test.result.downloadSingleMbps,
        downloadMultiMbps: test.result.downloadMultiMbps,
        uploadMbps: test.result.uploadMbps,
        uploadSingleMbps: test.result.uploadSingleMbps,
        uploadMultiMbps: test.result.uploadMultiMbps,
        packetLoss: test.result.packetLoss,
        packetLossPercent: test.result.packetLossPercent,
        successRate: test.result.successRate,
        successRatePercent: test.result.successRatePercent,
        stability: test.result.stability,
        singleThread: test.result.singleThread,
        testedAt: item.finishedAt,
        isDemo: true,
      },
      create: {
        speedTestId: test.id,
        latencyMs: test.result.latencyMs,
        minLatencyMs: test.result.minLatencyMs,
        maxLatencyMs: test.result.maxLatencyMs,
        downloadMbps: test.result.downloadMbps,
        downloadSingleMbps: test.result.downloadSingleMbps,
        downloadMultiMbps: test.result.downloadMultiMbps,
        uploadMbps: test.result.uploadMbps,
        uploadSingleMbps: test.result.uploadSingleMbps,
        uploadMultiMbps: test.result.uploadMultiMbps,
        packetLoss: test.result.packetLoss,
        packetLossPercent: test.result.packetLossPercent,
        successRate: test.result.successRate,
        successRatePercent: test.result.successRatePercent,
        stability: test.result.stability,
        singleThread: test.result.singleThread,
        testedAt: item.finishedAt,
        isDemo: true,
      },
    });
  }

  await prisma.speedTest.upsert({
    where: { id: "st_pending_demo" },
    update: {
      status: "PENDING",
      mode: "SINGLE_THREAD",
      concurrency: 1,
      region: "香港",
      startedAt: null,
      finishedAt: null,
      errorMessage: null,
      isDemo: true,
      serverId: "server-hk-demo",
      nodeId: "node_dukou_jp",
    },
    create: {
      id: "st_pending_demo",
      airportId: "ap_dukou",
      nodeId: "node_dukou_jp",
      serverId: "server-hk-demo",
      status: "PENDING",
      mode: "SINGLE_THREAD",
      concurrency: 1,
      region: "香港",
      isDemo: true,
    },
  });

  await prisma.speedTest.upsert({
    where: { id: "st_failed_demo" },
    update: {
      status: "FAILED",
      mode: "SINGLE_THREAD",
      concurrency: 1,
      region: "日本",
      startedAt: hoursAgo(1.5),
      finishedAt: hoursAgo(1.4),
      errorMessage: "模拟测速执行失败（演示）。",
      isDemo: true,
      serverId: "server-jp-demo",
      nodeId: "node_dengta_jp",
    },
    create: {
      id: "st_failed_demo",
      airportId: "ap_dengta",
      nodeId: "node_dengta_jp",
      serverId: "server-jp-demo",
      status: "FAILED",
      mode: "SINGLE_THREAD",
      concurrency: 1,
      region: "日本",
      startedAt: hoursAgo(1.5),
      finishedAt: hoursAgo(1.4),
      errorMessage: "模拟测速执行失败（演示）。",
      isDemo: true,
    },
  });

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
        title: "第三阶段 A：模拟测速任务",
        content:
          "当前库内记录均为明确标记的演示数据（isDemo=true）。测速结果由 mock executor 写入，不代表真实机场表现。清空数据库后，网站会回退到内存演示数据。",
        status: announcement.status,
        publishedAt: announcement.publishedAt,
        isDemo: true,
      },
      create: {
        id: announcement.id,
        title: "第三阶段 A：模拟测速任务",
        content:
          "当前库内记录均为明确标记的演示数据（isDemo=true）。测速结果由 mock executor 写入，不代表真实机场表现。清空数据库后，网站会回退到内存演示数据。",
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
