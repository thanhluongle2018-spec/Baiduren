/**
 * Speed-test domain types.
 * The website never runs probes itself. A future Worker / Agent owns execution.
 */

export type SpeedTestMode = "SINGLE_THREAD" | "MULTI_THREAD";

export type SpeedTestJobStatus =
  | "PENDING"
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type CreateSpeedTestJob = {
  airportId: string;
  nodeId: string;
  serverId?: string;
  region: string;
  mode: SpeedTestMode;
};

export type SpeedTestMetrics = {
  latencyMs: number | null;
  downloadMbps: number | null;
  uploadMbps: number | null;
  packetLoss: number | null;
  successRate: number | null;
  stability: number | null;
  testedAt: string;
  region: string;
  serverId: string | null;
  nodeId: string;
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
