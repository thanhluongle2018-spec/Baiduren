import { siteConfig } from "@/lib/config";
import type {
  AnnouncementRecord,
  AirportDetail,
  AirportNode,
  AirportPlan,
  AirportSummary,
  CategorySummary,
  PromotionRecord,
  RankingRow,
  ReviewRecord,
  SpeedTestRecord,
} from "@/types";

export const isDemoData = true;

export const categories: CategorySummary[] = [
  {
    id: "cat_general",
    name: "综合型",
    slug: "general",
    description: "覆盖多地区节点，适合作为对照样本。",
  },
  {
    id: "cat_latency",
    name: "低延迟",
    slug: "low-latency",
    description: "用于展示延迟字段，不代表真实线路质量。",
  },
  {
    id: "cat_streaming",
    name: "流媒体",
    slug: "streaming",
    description: "用于展示分类结构。",
  },
  {
    id: "cat_value",
    name: "性价比",
    slug: "value",
    description: "用于展示套餐价格字段。",
  },
];

export const airports: AirportSummary[] = [
  {
    id: "ap_dukou",
    name: "渡口云",
    slug: "dukou-yun",
    summary: "演示用综合型机场样本，用于排行榜与详情页布局。",
    description:
      "渡口云是第一阶段内置的演示机场。名称、套餐、节点与测速记录均为虚构，仅用于核对数据结构。正式环境中，这些字段将由数据库与测速 Worker 写入。",
    logoText: "渡",
    websiteUrl: "https://example.com/demo/dukou-yun",
    status: "ACTIVE",
    score: 8.6,
    categorySlug: "general",
    updatedAt: "2026-09-16T10:20:00.000Z",
  },
  {
    id: "ap_beian",
    name: "北岸网络",
    slug: "beian-wangluo",
    summary: "演示用低延迟样本，展示延迟与稳定性字段。",
    description:
      "北岸网络为演示数据，不对应任何真实服务商。页面上的延迟、下载速度和稳定性均为占位数值。",
    logoText: "北",
    websiteUrl: "https://example.com/demo/beian-wangluo",
    status: "ACTIVE",
    score: 8.2,
    categorySlug: "low-latency",
    updatedAt: "2026-09-16T09:05:00.000Z",
  },
  {
    id: "ap_dengta",
    name: "灯塔线路",
    slug: "dengta-xianlu",
    summary: "演示用流媒体分类样本。",
    description:
      "灯塔线路仅作为分类与套餐展示样本。本站第一阶段不接入真实节点，也不提供连接功能。",
    logoText: "灯",
    websiteUrl: "https://example.com/demo/dengta-xianlu",
    status: "ACTIVE",
    score: 7.8,
    categorySlug: "streaming",
    updatedAt: "2026-09-15T18:40:00.000Z",
  },
  {
    id: "ap_qingzhou",
    name: "青洲互联",
    slug: "qingzhou-hulian",
    summary: "演示用性价比样本，用于价格列展示。",
    description:
      "青洲互联的套餐价格为演示占位，便于排行榜价格列对齐。后续可由 AirportPlan 表替换。",
    logoText: "青",
    websiteUrl: "https://example.com/demo/qingzhou-hulian",
    status: "ACTIVE",
    score: 7.4,
    categorySlug: "value",
    updatedAt: "2026-09-15T12:10:00.000Z",
  },
  {
    id: "ap_chenfeng",
    name: "晨风加速",
    slug: "chenfeng-jiasu",
    summary: "演示用新机场样本，评分与测速记录较少。",
    description:
      "晨风加速用于展示数据较少时的详情页结构。评价与测速记录均为演示内容。",
    logoText: "晨",
    websiteUrl: "https://example.com/demo/chenfeng-jiasu",
    status: "ACTIVE",
    score: 6.9,
    categorySlug: "general",
    updatedAt: "2026-09-14T16:30:00.000Z",
  },
];

export const plans: AirportPlan[] = [
  {
    id: "plan_dukou_m",
    airportId: "ap_dukou",
    name: "月付基础",
    price: 36,
    currency: "CNY",
    billingCycle: "monthly",
    trafficGb: 200,
    deviceLimit: 3,
    features: ["演示套餐", "不对应真实库存"],
    status: "ACTIVE",
  },
  {
    id: "plan_dukou_y",
    airportId: "ap_dukou",
    name: "年付标准",
    price: 360,
    currency: "CNY",
    billingCycle: "yearly",
    trafficGb: 400,
    deviceLimit: 5,
    features: ["演示套餐", "字段占位"],
    status: "ACTIVE",
  },
  {
    id: "plan_beian_m",
    airportId: "ap_beian",
    name: "月付",
    price: 42,
    currency: "CNY",
    billingCycle: "monthly",
    trafficGb: 150,
    deviceLimit: 2,
    features: ["演示套餐"],
    status: "ACTIVE",
  },
  {
    id: "plan_dengta_m",
    airportId: "ap_dengta",
    name: "月付",
    price: 28,
    currency: "CNY",
    billingCycle: "monthly",
    trafficGb: 300,
    deviceLimit: 3,
    features: ["演示套餐"],
    status: "ACTIVE",
  },
  {
    id: "plan_qingzhou_m",
    airportId: "ap_qingzhou",
    name: "月付入门",
    price: 18,
    currency: "CNY",
    billingCycle: "monthly",
    trafficGb: 100,
    deviceLimit: 2,
    features: ["演示套餐"],
    status: "ACTIVE",
  },
  {
    id: "plan_chenfeng_m",
    airportId: "ap_chenfeng",
    name: "月付",
    price: 24,
    currency: "CNY",
    billingCycle: "monthly",
    trafficGb: 120,
    deviceLimit: 2,
    features: ["演示套餐"],
    status: "ACTIVE",
  },
];

export const nodes: AirportNode[] = [
  {
    id: "node_dukou_hk",
    airportId: "ap_dukou",
    name: "香港 01",
    region: "香港",
    kind: "中转",
    status: "ACTIVE",
  },
  {
    id: "node_dukou_jp",
    airportId: "ap_dukou",
    name: "东京 01",
    region: "东京",
    kind: "中转",
    status: "ACTIVE",
  },
  {
    id: "node_beian_tw",
    airportId: "ap_beian",
    name: "台北 01",
    region: "台北",
    kind: "直连",
    status: "ACTIVE",
  },
  {
    id: "node_dengta_sg",
    airportId: "ap_dengta",
    name: "新加坡 01",
    region: "新加坡",
    kind: "中转",
    status: "ACTIVE",
  },
  {
    id: "node_qingzhou_us",
    airportId: "ap_qingzhou",
    name: "洛杉矶 01",
    region: "洛杉矶",
    kind: "中转",
    status: "ACTIVE",
  },
  {
    id: "node_chenfeng_kr",
    airportId: "ap_chenfeng",
    name: "首尔 01",
    region: "首尔",
    kind: "直连",
    status: "ACTIVE",
  },
];

export const speedTests: SpeedTestRecord[] = [
  {
    id: "st_001",
    airportId: "ap_dukou",
    airportName: "渡口云",
    airportSlug: "dukou-yun",
    nodeId: "node_dukou_hk",
    nodeName: "香港 01",
    serverName: "演示测速点 · 上海",
    status: "COMPLETED",
    mode: "MULTI_THREAD",
    region: "上海",
    startedAt: "2026-09-16T10:00:00.000Z",
    finishedAt: "2026-09-16T10:02:00.000Z",
    result: {
      latencyMs: 38,
      downloadMbps: 126.4,
      uploadMbps: 42.1,
      packetLoss: 0.2,
      successRate: 99.0,
      stability: 92.0,
      testedAt: "2026-09-16T10:02:00.000Z",
    },
  },
  {
    id: "st_002",
    airportId: "ap_beian",
    airportName: "北岸网络",
    airportSlug: "beian-wangluo",
    nodeId: "node_beian_tw",
    nodeName: "台北 01",
    serverName: "演示测速点 · 上海",
    status: "COMPLETED",
    mode: "SINGLE_THREAD",
    region: "上海",
    startedAt: "2026-09-16T09:00:00.000Z",
    finishedAt: "2026-09-16T09:01:40.000Z",
    result: {
      latencyMs: 29,
      downloadMbps: 88.6,
      uploadMbps: 36.0,
      packetLoss: 0.1,
      successRate: 99.4,
      stability: 94.5,
      testedAt: "2026-09-16T09:01:40.000Z",
    },
  },
  {
    id: "st_003",
    airportId: "ap_dengta",
    airportName: "灯塔线路",
    airportSlug: "dengta-xianlu",
    nodeId: "node_dengta_sg",
    nodeName: "新加坡 01",
    serverName: "演示测速点 · 广州",
    status: "COMPLETED",
    mode: "MULTI_THREAD",
    region: "广州",
    startedAt: "2026-09-15T18:30:00.000Z",
    finishedAt: "2026-09-15T18:32:10.000Z",
    result: {
      latencyMs: 54,
      downloadMbps: 101.2,
      uploadMbps: 28.7,
      packetLoss: 0.6,
      successRate: 97.8,
      stability: 86.0,
      testedAt: "2026-09-15T18:32:10.000Z",
    },
  },
  {
    id: "st_004",
    airportId: "ap_qingzhou",
    airportName: "青洲互联",
    airportSlug: "qingzhou-hulian",
    nodeId: "node_qingzhou_us",
    nodeName: "洛杉矶 01",
    serverName: "演示测速点 · 广州",
    status: "COMPLETED",
    mode: "SINGLE_THREAD",
    region: "广州",
    startedAt: "2026-09-15T12:00:00.000Z",
    finishedAt: "2026-09-15T12:02:20.000Z",
    result: {
      latencyMs: 168,
      downloadMbps: 64.3,
      uploadMbps: 18.5,
      packetLoss: 1.1,
      successRate: 95.2,
      stability: 78.0,
      testedAt: "2026-09-15T12:02:20.000Z",
    },
  },
  {
    id: "st_005",
    airportId: "ap_chenfeng",
    airportName: "晨风加速",
    airportSlug: "chenfeng-jiasu",
    nodeId: "node_chenfeng_kr",
    nodeName: "首尔 01",
    serverName: "演示测速点 · 上海",
    status: "COMPLETED",
    mode: "SINGLE_THREAD",
    region: "上海",
    startedAt: "2026-09-14T16:20:00.000Z",
    finishedAt: "2026-09-14T16:21:50.000Z",
    result: {
      latencyMs: 47,
      downloadMbps: 72.8,
      uploadMbps: 22.4,
      packetLoss: 0.8,
      successRate: 96.5,
      stability: 81.0,
      testedAt: "2026-09-14T16:21:50.000Z",
    },
  },
];

export const reviews: ReviewRecord[] = [
  {
    id: "rv_001",
    airportId: "ap_dukou",
    airportName: "渡口云",
    rating: 4,
    title: "演示评价",
    content: "这是一条演示评价，只用于展示评分、标题与正文结构，不代表真实用户意见。",
    status: "PUBLISHED",
    authorLabel: "演示用户 A",
    createdAt: "2026-09-12T08:00:00.000Z",
  },
  {
    id: "rv_002",
    airportId: "ap_beian",
    airportName: "北岸网络",
    rating: 5,
    title: "演示评价",
    content: "演示内容：详情页需要至少一条评价来核对空状态以外的布局。",
    status: "PUBLISHED",
    authorLabel: "演示用户 B",
    createdAt: "2026-09-11T11:30:00.000Z",
  },
  {
    id: "rv_003",
    airportId: "ap_dengta",
    airportName: "灯塔线路",
    rating: 3,
    title: "演示评价",
    content: "演示内容：中等评分用于核对着色与排序，不是真实体验描述。",
    status: "PUBLISHED",
    authorLabel: "演示用户 C",
    createdAt: "2026-09-10T14:15:00.000Z",
  },
];

export const promotions: PromotionRecord[] = [
  {
    id: "promo_dukou",
    airportId: "ap_dukou",
    airportName: "渡口云",
    name: "演示推广位",
    affiliateUrl: "https://example.com/promo/demo-dukou",
    couponCode: "DEMO",
    status: "DRAFT",
    clickCount: 0,
  },
  {
    id: "promo_beian",
    airportId: "ap_beian",
    airportName: "北岸网络",
    name: "演示推广位",
    affiliateUrl: "https://example.com/promo/demo-beian",
    couponCode: null,
    status: "DRAFT",
    clickCount: 0,
  },
];

export const announcements: AnnouncementRecord[] = [
  {
    id: "an_001",
    title: "第一阶段：演示数据上线",
    content: `${siteConfig.name} 当前页面均使用演示数据。测速 Worker、真实机场与推广点击统计将在后续阶段接入。`,
    status: "ACTIVE",
    publishedAt: "2026-09-16T02:00:00.000Z",
  },
];

function cheapestPlanLabel(airportId: string) {
  const matched = plans
    .filter((plan) => plan.airportId === airportId && plan.status === "ACTIVE")
    .sort((a, b) => a.price - b.price);
  const plan = matched[0];
  if (!plan) return "—";
  const cycle =
    plan.billingCycle === "yearly"
      ? "年"
      : plan.billingCycle === "quarterly"
        ? "季"
        : "月";
  return `¥${plan.price.toFixed(0)} / ${cycle}`;
}

function latestTestForAirport(airportId: string) {
  return speedTests.find((item) => item.airportId === airportId);
}

export const rankingRows: RankingRow[] = airports
  .map((airport, index) => {
    const test = latestTestForAirport(airport.id);
    return {
      rank: index + 1,
      airportId: airport.id,
      slug: airport.slug,
      name: airport.name,
      logoText: airport.logoText,
      score: airport.score,
      latencyMs: test?.result.latencyMs ?? 0,
      downloadMbps: test?.result.downloadMbps ?? 0,
      uploadMbps: test?.result.uploadMbps ?? 0,
      packetLoss: test?.result.packetLoss ?? 0,
      successRate: test?.result.successRate ?? 0,
      stability: test?.result.stability ?? 0,
      priceLabel: cheapestPlanLabel(airport.id),
      updatedAt: airport.updatedAt,
    };
  })
  .sort((a, b) => b.score - a.score)
  .map((row, index) => ({ ...row, rank: index + 1 }));

export function getAirportBySlug(slug: string): AirportDetail | undefined {
  const airport = airports.find((item) => item.slug === slug);
  if (!airport) return undefined;
  const category = categories.find((item) => item.slug === airport.categorySlug);
  return {
    ...airport,
    categoryName: category?.name ?? "未分类",
    plans: plans.filter((item) => item.airportId === airport.id),
    nodes: nodes.filter((item) => item.airportId === airport.id),
    speedTests: speedTests.filter((item) => item.airportId === airport.id),
    reviews: reviews.filter((item) => item.airportId === airport.id),
    promotions: promotions.filter((item) => item.airportId === airport.id),
  };
}
