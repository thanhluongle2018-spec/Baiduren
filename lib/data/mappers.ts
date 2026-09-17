import { logoTextFromName, toIso, toNullableBoolean, toNullableInt, toNullableNumber, toNumber } from "@/lib/data/source";
import { formatPrice } from "@/lib/format";
import {
  isSpeedTestStage,
  sanitizeEngineErrorCode,
  sanitizeSkippedStages,
  sanitizeStageStatus,
} from "@/lib/speedtest/raw-metrics";
import { redactSecrets } from "@/lib/subscription/secrets";
import type {
  AirportDetail,
  AirportNode,
  AirportPlan,
  AirportSummary,
  AnnouncementRecord,
  PromotionRecord,
  ReviewRecord,
  SpeedTestRecord,
  SpeedTestResultView,
} from "@/types";

type DecimalLike = unknown;

type DbAirport = {
  id: string;
  name: string;
  slug: string;
  summary: string;
  description: string | null;
  websiteUrl: string | null;
  status: AirportSummary["status"];
  score: DecimalLike;
  updatedAt: Date;
  category?: { slug: string; name: string } | null;
};

type DbPlan = {
  id: string;
  airportId: string;
  name: string;
  price: DecimalLike;
  currency: string;
  billingCycle: string;
  trafficGb: number | null;
  deviceLimit: number | null;
  features: string[];
  status: AirportPlan["status"];
};

type DbNode = {
  id: string;
  airportId: string;
  name: string;
  region: string;
  kind: string;
  status: AirportNode["status"];
};

type DbReview = {
  id: string;
  airportId: string;
  rating: number;
  title: string | null;
  content: string;
  status: ReviewRecord["status"];
  createdAt: Date;
  airport?: { name: string } | null;
};

type DbAnnouncement = {
  id: string;
  title: string;
  content: string;
  status: AnnouncementRecord["status"];
  publishedAt: Date | null;
};

type DbPromotion = {
  id: string;
  airportId: string;
  name: string;
  affiliateUrl: string;
  couponCode: string | null;
  status: PromotionRecord["status"];
  clickCount: number;
  airport?: { name: string } | null;
};

type DbResult = {
  latencyMs: DecimalLike;
  minLatencyMs?: DecimalLike;
  maxLatencyMs?: DecimalLike;
  latencyAvgMs?: DecimalLike;
  latencyP50Ms?: DecimalLike;
  latencyP90Ms?: DecimalLike;
  latencyAttempts?: number | null;
  latencySuccessCount?: number | null;
  downloadMbps: DecimalLike;
  downloadSingleMbps?: DecimalLike;
  downloadMultiMbps?: DecimalLike;
  uploadMbps: DecimalLike;
  uploadSingleMbps?: DecimalLike;
  uploadMultiMbps?: DecimalLike;
  packetLoss: DecimalLike;
  packetLossPercent?: DecimalLike;
  packetLossTotal?: number | null;
  packetLossSuccess?: number | null;
  successRate: DecimalLike;
  successRatePercent?: DecimalLike;
  successRateTotal?: number | null;
  successRateSuccess?: number | null;
  stability: DecimalLike;
  singleDownloadBytes?: number | null;
  singleDownloadDurationMs?: number | null;
  singleDownloadStatus?: string | null;
  multiDownloadBytes?: number | null;
  multiDownloadDurationMs?: number | null;
  multiDownloadConcurrency?: number | null;
  multiDownloadStatus?: string | null;
  singleUploadBytes?: number | null;
  singleUploadDurationMs?: number | null;
  singleUploadStatus?: string | null;
  multiUploadBytes?: number | null;
  multiUploadDurationMs?: number | null;
  multiUploadConcurrency?: number | null;
  multiUploadStatus?: string | null;
  skippedStages?: unknown;
  errorCode?: string | null;
  errorMessage?: string | null;
  exitVerified?: boolean | null;
  directIdentityHash?: string | null;
  proxiedIdentityHash?: string | null;
  singleThread?: boolean;
  testedAt: Date;
  isDemo?: boolean;
};

type DbSpeedTest = {
  id: string;
  airportId: string;
  nodeId: string | null;
  serverId?: string | null;
  status: SpeedTestRecord["status"];
  mode: SpeedTestRecord["mode"];
  concurrency?: number;
  region: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  errorMessage?: string | null;
  errorCode?: string | null;
  testVersion?: string | null;
  currentStage?: string | null;
  latencyAttempts?: number | null;
  pingTimeoutMs?: number | null;
  downloadConcurrency?: number | null;
  uploadConcurrency?: number | null;
  singleDownloadCapBytes?: number | null;
  multiDownloadCapBytes?: number | null;
  singleUploadCapBytes?: number | null;
  multiUploadCapBytes?: number | null;
  totalTrafficCapBytes?: number | null;
  serverMaxConcurrencySnapshot?: number | null;
  serverBandwidthMbpsSnapshot?: number | null;
  nodeConcurrencySnapshot?: number | null;
  airportConcurrencySnapshot?: number | null;
  isDemo?: boolean;
  airport?: { name: string; slug: string } | null;
  node?: { name: string } | null;
  server?: { id?: string; name: string } | null;
  result?: DbResult | null;
};

export function mapResultMetrics(result: DbResult): SpeedTestResultView {
  const latencyMs = toNumber(result.latencyMs);
  const downloadMbps = toNumber(result.downloadMbps);
  const uploadMbps = toNumber(result.uploadMbps);
  const packetLoss = toNumber(result.packetLossPercent ?? result.packetLoss);
  const successRate = toNumber(result.successRatePercent ?? result.successRate);
  const testedAt = toIso(result.testedAt);
  const downloadSingle = toNumber(result.downloadSingleMbps, downloadMbps);
  const downloadMulti = toNumber(result.downloadMultiMbps, downloadMbps);
  const uploadSingle = toNumber(result.uploadSingleMbps, uploadMbps);
  const uploadMulti = toNumber(result.uploadMultiMbps, uploadMbps);

  return {
    latencyMs,
    minLatencyMs: toNumber(result.minLatencyMs, latencyMs),
    maxLatencyMs: toNumber(result.maxLatencyMs, latencyMs),
    downloadMbps,
    downloadSingleMbps: downloadSingle,
    downloadMultiMbps: downloadMulti,
    uploadMbps,
    uploadSingleMbps: uploadSingle,
    uploadMultiMbps: uploadMulti,
    packetLoss,
    packetLossPercent: packetLoss,
    successRate,
    successRatePercent: successRate,
    stability: toNumber(result.stability),
    singleThread: result.singleThread === true,
    testedAt,
    measuredAt: testedAt,
    isDemo: result.isDemo !== false,
    latencyAvgMs: toNullableNumber(result.latencyAvgMs),
    latencyP50Ms: toNullableNumber(result.latencyP50Ms),
    latencyP90Ms: toNullableNumber(result.latencyP90Ms),
    latencyAttempts: toNullableInt(result.latencyAttempts),
    latencySuccessCount: toNullableInt(result.latencySuccessCount),
    packetLossTotal: toNullableInt(result.packetLossTotal),
    packetLossSuccess: toNullableInt(result.packetLossSuccess),
    successRateTotal: toNullableInt(result.successRateTotal),
    successRateSuccess: toNullableInt(result.successRateSuccess),
    singleDownloadBytes: toNullableInt(result.singleDownloadBytes),
    singleDownloadDurationMs: toNullableInt(result.singleDownloadDurationMs),
    singleDownloadStatus: sanitizeStageStatus(result.singleDownloadStatus),
    multiDownloadBytes: toNullableInt(result.multiDownloadBytes),
    multiDownloadDurationMs: toNullableInt(result.multiDownloadDurationMs),
    multiDownloadConcurrency: toNullableInt(result.multiDownloadConcurrency),
    multiDownloadStatus: sanitizeStageStatus(result.multiDownloadStatus),
    singleUploadBytes: toNullableInt(result.singleUploadBytes),
    singleUploadDurationMs: toNullableInt(result.singleUploadDurationMs),
    singleUploadStatus: sanitizeStageStatus(result.singleUploadStatus),
    multiUploadBytes: toNullableInt(result.multiUploadBytes),
    multiUploadDurationMs: toNullableInt(result.multiUploadDurationMs),
    multiUploadConcurrency: toNullableInt(result.multiUploadConcurrency),
    multiUploadStatus: sanitizeStageStatus(result.multiUploadStatus),
    skippedStages: sanitizeSkippedStages(result.skippedStages),
    errorCode: sanitizeEngineErrorCode(result.errorCode),
    errorMessage: result.errorMessage ? redactSecrets(result.errorMessage) : null,
    exitVerified: toNullableBoolean(result.exitVerified),
  };
}

export function mapAirportSummary(airport: DbAirport): AirportSummary {
  return {
    id: airport.id,
    name: airport.name,
    slug: airport.slug,
    summary: airport.summary,
    description: airport.description ?? airport.summary,
    logoText: logoTextFromName(airport.name),
    websiteUrl: airport.websiteUrl ?? "https://example.com/demo",
    status: airport.status,
    score: toNumber(airport.score),
    categorySlug: airport.category?.slug ?? "general",
    updatedAt: toIso(airport.updatedAt),
  };
}

export function mapPlan(plan: DbPlan): AirportPlan {
  const cycle =
    plan.billingCycle === "yearly" || plan.billingCycle === "quarterly"
      ? plan.billingCycle
      : "monthly";
  return {
    id: plan.id,
    airportId: plan.airportId,
    name: plan.name,
    price: toNumber(plan.price),
    currency: "CNY",
    billingCycle: cycle,
    trafficGb: plan.trafficGb,
    deviceLimit: plan.deviceLimit,
    features: plan.features,
    status: plan.status,
  };
}

export function mapNode(node: DbNode): AirportNode {
  return {
    id: node.id,
    airportId: node.airportId,
    name: node.name,
    region: node.region,
    kind: node.kind,
    status: node.status,
  };
}

export function mapReview(review: DbReview): ReviewRecord {
  return {
    id: review.id,
    airportId: review.airportId,
    airportName: review.airport?.name ?? "",
    rating: review.rating,
    title: review.title ?? "评价",
    content: review.content,
    status: review.status,
    authorLabel: "数据库记录",
    createdAt: toIso(review.createdAt),
  };
}

export function mapAnnouncement(item: DbAnnouncement): AnnouncementRecord {
  return {
    id: item.id,
    title: item.title,
    content: item.content,
    status: item.status,
    publishedAt: toIso(item.publishedAt),
  };
}

export function mapPromotion(item: DbPromotion): PromotionRecord {
  return {
    id: item.id,
    airportId: item.airportId,
    airportName: item.airport?.name ?? "",
    name: item.name,
    affiliateUrl: item.affiliateUrl,
    couponCode: item.couponCode,
    status: item.status,
    clickCount: item.clickCount,
  };
}

export function mapSpeedTest(test: DbSpeedTest): SpeedTestRecord {
  return {
    id: test.id,
    airportId: test.airportId,
    airportName: test.airport?.name ?? "",
    airportSlug: test.airport?.slug ?? "",
    nodeId: test.nodeId ?? "",
    nodeName: test.node?.name ?? "",
    serverId: test.serverId ?? test.server?.id ?? "",
    serverName: test.server?.name ?? "测速点",
    status: test.status,
    mode: test.mode,
    concurrency: test.concurrency ?? (test.mode === "MULTI_THREAD" ? 4 : 1),
    region: test.region,
    startedAt: test.startedAt ? toIso(test.startedAt) : null,
    finishedAt: test.finishedAt ? toIso(test.finishedAt) : null,
    errorMessage: test.errorMessage ? redactSecrets(test.errorMessage) : null,
    isDemo: test.isDemo !== false,
    result: test.result ? mapResultMetrics(test.result) : null,
    testVersion: test.testVersion ?? null,
    currentStage: isSpeedTestStage(test.currentStage) ? test.currentStage : null,
    errorCode: sanitizeEngineErrorCode(test.errorCode),
    latencyAttempts: toNullableInt(test.latencyAttempts),
    pingTimeoutMs: toNullableInt(test.pingTimeoutMs),
    downloadConcurrency: toNullableInt(test.downloadConcurrency),
    uploadConcurrency: toNullableInt(test.uploadConcurrency),
    singleDownloadCapBytes: toNullableInt(test.singleDownloadCapBytes),
    multiDownloadCapBytes: toNullableInt(test.multiDownloadCapBytes),
    singleUploadCapBytes: toNullableInt(test.singleUploadCapBytes),
    multiUploadCapBytes: toNullableInt(test.multiUploadCapBytes),
    totalTrafficCapBytes: toNullableInt(test.totalTrafficCapBytes),
    serverMaxConcurrencySnapshot: toNullableInt(test.serverMaxConcurrencySnapshot),
    serverBandwidthMbpsSnapshot: toNullableInt(test.serverBandwidthMbpsSnapshot),
    nodeConcurrencySnapshot: toNullableInt(test.nodeConcurrencySnapshot),
    airportConcurrencySnapshot: toNullableInt(test.airportConcurrencySnapshot),
  };
}

export function cheapestPlanLabel(plans: AirportPlan[]) {
  const active = plans
    .filter((plan) => plan.status === "ACTIVE")
    .sort((a, b) => a.price - b.price);
  const plan = active[0];
  if (!plan) return "—";
  return formatPrice(plan.price, plan.billingCycle);
}

export function mapAirportDetail(
  airport: DbAirport & {
    plans: DbPlan[];
    nodes: DbNode[];
    speedTests: DbSpeedTest[];
    reviews: DbReview[];
    promotions: DbPromotion[];
  }
): AirportDetail {
  return {
    ...mapAirportSummary(airport),
    categoryName: airport.category?.name ?? "未分类",
    plans: airport.plans.map(mapPlan),
    nodes: airport.nodes.map(mapNode),
    speedTests: airport.speedTests.map(mapSpeedTest),
    reviews: airport.reviews.map((review) =>
      mapReview({ ...review, airport: { name: airport.name } })
    ),
    promotions: airport.promotions.map(mapPromotion),
  };
}
