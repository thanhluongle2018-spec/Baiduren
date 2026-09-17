export type DataMode = "demo" | "database";

export type ContentStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
export type SpeedTestServerStatus = "ACTIVE" | "DISABLED";
export type SpeedTestStatus =
  | "PENDING"
  | "QUEUED"
  | "RUNNING"
  | "SUCCESS"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";
export type SpeedTestMode = "SINGLE_THREAD" | "MULTI_THREAD";
export type ReviewStatus = "PENDING" | "PUBLISHED" | "HIDDEN";
export type SpeedTestStage =
  | "LATENCY"
  | "PACKET_LOSS"
  | "SINGLE_DOWNLOAD"
  | "MULTI_DOWNLOAD"
  | "SINGLE_UPLOAD"
  | "MULTI_UPLOAD"
  | "COMPLETE";
export type SpeedTestStageStatus =
  | "SUCCESS"
  | "PARTIAL"
  | "TIMEOUT"
  | "FAILED"
  | "SKIPPED";

export type CategorySummary = {
  id: string;
  name: string;
  slug: string;
  description: string;
};

export type AirportSummary = {
  id: string;
  name: string;
  slug: string;
  summary: string;
  description: string;
  logoText: string;
  websiteUrl: string;
  status: ContentStatus;
  score: number;
  categorySlug: string;
  updatedAt: string;
};

export type AirportPlan = {
  id: string;
  airportId: string;
  name: string;
  price: number;
  currency: "CNY";
  billingCycle: "monthly" | "quarterly" | "yearly";
  trafficGb: number | null;
  deviceLimit: number | null;
  features: string[];
  status: ContentStatus;
};

export type AirportNode = {
  id: string;
  airportId: string;
  name: string;
  region: string;
  kind: string;
  status: ContentStatus;
};

export type SpeedTestResultView = {
  latencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  downloadMbps: number;
  downloadSingleMbps: number;
  downloadMultiMbps: number;
  uploadMbps: number;
  uploadSingleMbps: number;
  uploadMultiMbps: number;
  packetLoss: number;
  packetLossPercent: number;
  successRate: number;
  successRatePercent: number;
  stability: number;
  singleThread: boolean;
  testedAt: string;
  measuredAt: string;
  isDemo: boolean;
  latencyAvgMs: number | null;
  latencyP50Ms: number | null;
  latencyP90Ms: number | null;
  latencyAttempts: number | null;
  latencySuccessCount: number | null;
  packetLossTotal: number | null;
  packetLossSuccess: number | null;
  successRateTotal: number | null;
  successRateSuccess: number | null;
  singleDownloadBytes: number | null;
  singleDownloadDurationMs: number | null;
  singleDownloadStatus: SpeedTestStageStatus | null;
  multiDownloadBytes: number | null;
  multiDownloadDurationMs: number | null;
  multiDownloadConcurrency: number | null;
  multiDownloadStatus: SpeedTestStageStatus | null;
  singleUploadBytes: number | null;
  singleUploadDurationMs: number | null;
  singleUploadStatus: SpeedTestStageStatus | null;
  multiUploadBytes: number | null;
  multiUploadDurationMs: number | null;
  multiUploadConcurrency: number | null;
  multiUploadStatus: SpeedTestStageStatus | null;
  skippedStages: SpeedTestStage[] | null;
  errorCode: string | null;
  errorMessage: string | null;
  exitVerified: boolean | null;
};

export type SpeedTestRecord = {
  id: string;
  airportId: string;
  airportName: string;
  airportSlug: string;
  nodeId: string;
  nodeName: string;
  serverId: string;
  serverName: string;
  status: SpeedTestStatus;
  mode: SpeedTestMode;
  concurrency: number;
  region: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  isDemo: boolean;
  result: SpeedTestResultView | null;
  testVersion?: string | null;
  currentStage?: SpeedTestStage | null;
  errorCode?: string | null;
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
};

export type ReviewRecord = {
  id: string;
  airportId: string;
  airportName: string;
  rating: number;
  title: string;
  content: string;
  status: ReviewStatus;
  authorLabel: string;
  createdAt: string;
};

export type PromotionRecord = {
  id: string;
  airportId: string;
  airportName: string;
  name: string;
  affiliateUrl: string;
  couponCode: string | null;
  status: ContentStatus;
  clickCount: number;
};

export type AnnouncementRecord = {
  id: string;
  title: string;
  content: string;
  status: ContentStatus;
  publishedAt: string;
};

export type RankingRow = {
  rank: number;
  airportId: string;
  slug: string;
  name: string;
  logoText: string;
  score: number;
  latencyMs: number;
  p50LatencyMs: number;
  downloadMbps: number;
  downloadSingleMbps: number;
  downloadMultiMbps: number;
  uploadMbps: number;
  uploadSingleMbps: number;
  uploadMultiMbps: number;
  packetLoss: number;
  successRate: number;
  stability: number;
  sampleCount: number;
  priceLabel: string;
  updatedAt: string;
};

export type AirportDetail = AirportSummary & {
  categoryName: string;
  plans: AirportPlan[];
  nodes: AirportNode[];
  speedTests: SpeedTestRecord[];
  reviews: ReviewRecord[];
  promotions: PromotionRecord[];
};
