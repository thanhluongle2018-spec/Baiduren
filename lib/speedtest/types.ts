/**
 * Speed-test domain types.
 * The website never runs probes itself. The Worker owns execution.
 * Default production executor remains mock. RealSpeedTestExecutor is C1 skeleton only.
 */

import type { EngineErrorCode } from "@/lib/speedtest/metrics";
import type {
  SpeedTestStageName,
  SpeedTestStageStatusName,
} from "@/lib/speedtest/raw-metrics";

export type SpeedTestMode = "SINGLE_THREAD" | "MULTI_THREAD";

export type SpeedTestJobStatus =
  | "PENDING"
  | "QUEUED"
  | "RUNNING"
  | "SUCCESS"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type SpeedTestServerStatus = "ACTIVE" | "DISABLED";

export type CreateSpeedTestJobInput = {
  airportId: string;
  nodeId: string;
  speedTestServerId: string;
  concurrency?: number;
  isDemo?: boolean;
};

export type CreateSpeedTestJob = {
  airportId: string;
  nodeId: string;
  serverId?: string;
  region: string;
  mode: SpeedTestMode;
};

export type SpeedTestMetrics = {
  latencyMs: number | null;
  minLatencyMs: number | null;
  maxLatencyMs: number | null;
  downloadMbps: number | null;
  downloadSingleMbps: number | null;
  downloadMultiMbps: number | null;
  uploadMbps: number | null;
  uploadSingleMbps: number | null;
  uploadMultiMbps: number | null;
  packetLoss: number | null;
  packetLossPercent: number | null;
  successRate: number | null;
  successRatePercent: number | null;
  stability: number | null;
  singleThread: boolean;
  testedAt: string;
  region: string;
  serverId: string | null;
  nodeId: string;
  isDemo: boolean;
};

export type MockSpeedTestMetrics = {
  latencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  downloadSingleMbps: number;
  downloadMultiMbps: number;
  uploadSingleMbps: number;
  uploadMultiMbps: number;
  packetLossPercent: number;
  successRatePercent: number;
  stability: number;
  singleThread: boolean;
  isDemo: true;
};

export type SpeedTestParamSnapshot = {
  testVersion: string | null;
  latencyAttempts: number | null;
  pingTimeoutMs: number | null;
  downloadConcurrency: number | null;
  uploadConcurrency: number | null;
  singleDownloadCapBytes: number | null;
  multiDownloadCapBytes: number | null;
  singleUploadCapBytes: number | null;
  multiUploadCapBytes: number | null;
  totalTrafficCapBytes: number | null;
};

export type SpeedTestJob = {
  id: string;
  status: SpeedTestJobStatus;
  payload: CreateSpeedTestJob;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  metrics: SpeedTestMetrics | null;
  errorMessage: string | null;
};

export interface SpeedTestWorkerClient {
  enqueue(job: CreateSpeedTestJob): Promise<Pick<SpeedTestJob, "id" | "status">>;
  getJob(id: string): Promise<SpeedTestJob | null>;
}

export type ClaimedSpeedTestJob = {
  id: string;
  airportId: string;
  nodeId: string | null;
  serverId: string | null;
  region: string;
  concurrency: number;
  isDemo: boolean;
  airportName: string;
  nodeName: string | null;
  serverName: string | null;
};

/**
 * Worker-facing executor contract. kind is mock-only so the production
 * Worker cannot persist a real-looking result by accident.
 */
export interface SpeedTestExecutor {
  readonly kind: "mock";
  run(job: ClaimedSpeedTestJob): Promise<MockSpeedTestMetrics>;
}

export type SpeedTestResultProvenance = "demo-fixture" | "unproven" | "blocked-real";

export type RealSpeedTestRawResult = {
  kind: "real-executor";
  isDemo: true;
  provenance: SpeedTestResultProvenance;
  exitVerified: false;
  runtimeKind: "fake" | "mihomo" | null;
  runtimeCleanedUp: boolean;
  currentStage: SpeedTestStageName | null;
  skippedStages: SpeedTestStageName[];
  errorCode: EngineErrorCode | null;
  errorMessage: string | null;
  directIdentityHash: string | null;
  proxiedIdentityHash: string | null;
  latencyMs: number | null;
  latencyMinMs: number | null;
  latencyMaxMs: number | null;
  latencyAvgMs: number | null;
  latencyP50Ms: number | null;
  latencyP90Ms: number | null;
  latencyAttempts: number | null;
  latencySuccessCount: number | null;
  packetLossPercent: number | null;
  packetLossTotal: number | null;
  packetLossSuccess: number | null;
  successRatePercent: number | null;
  successRateTotal: number | null;
  successRateSuccess: number | null;
  downloadSingleMbps: number | null;
  singleDownloadBytes: number | null;
  singleDownloadDurationMs: number | null;
  singleDownloadStatus: SpeedTestStageStatusName | null;
  downloadMultiMbps: number | null;
  multiDownloadBytes: number | null;
  multiDownloadDurationMs: number | null;
  multiDownloadConcurrency: number | null;
  multiDownloadStatus: SpeedTestStageStatusName | null;
  uploadSingleMbps: number | null;
  singleUploadBytes: number | null;
  singleUploadDurationMs: number | null;
  singleUploadStatus: SpeedTestStageStatusName | null;
  uploadMultiMbps: number | null;
  multiUploadBytes: number | null;
  multiUploadDurationMs: number | null;
  multiUploadConcurrency: number | null;
  multiUploadStatus: SpeedTestStageStatusName | null;
  stability: null;
  testedAt: string;
};

export interface RawMetricsExecutor {
  readonly kind: "real";
  run(job: ClaimedSpeedTestJob): Promise<RealSpeedTestRawResult>;
}

/** Shared shape: kind + run(job). Worker only accepts SpeedTestExecutor (mock). */
export type AnySpeedTestExecutor = SpeedTestExecutor | RawMetricsExecutor;

/**
 * Queue port so a future Redis/BullMQ implementation can replace the
 * PostgreSQL-backed claim path without rewriting Worker orchestration.
 */
export interface SpeedTestJobQueue {
  enqueue(input: CreateSpeedTestJobInput): Promise<{ id: string; status: SpeedTestJobStatus }>;
  claimNext(): Promise<ClaimedSpeedTestJob | null>;
}
