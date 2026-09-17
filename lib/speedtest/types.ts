/**
 * Speed-test domain types.
 * The website never runs probes itself. The Worker owns execution.
 * Phase 3A executor is mock/simulated only.
 */

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

export interface SpeedTestExecutor {
  readonly kind: "mock";
  run(job: ClaimedSpeedTestJob): Promise<MockSpeedTestMetrics>;
}

/**
 * Queue port so a future Redis/BullMQ implementation can replace the
 * PostgreSQL-backed claim path without rewriting Worker orchestration.
 */
export interface SpeedTestJobQueue {
  enqueue(input: CreateSpeedTestJobInput): Promise<{ id: string; status: SpeedTestJobStatus }>;
  claimNext(): Promise<ClaimedSpeedTestJob | null>;
}
