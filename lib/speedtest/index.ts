export type {
  AnySpeedTestExecutor,
  ClaimedSpeedTestJob,
  CreateSpeedTestJob,
  CreateSpeedTestJobInput,
  MockSpeedTestMetrics,
  RawMetricsExecutor,
  RealSpeedTestRawResult,
  SpeedTestExecutor,
  SpeedTestJob,
  SpeedTestJobQueue,
  SpeedTestResultProvenance,
  SpeedTestWorkerClient,
} from "@/lib/speedtest/types";
export { speedTestClient, StubSpeedTestClient } from "@/lib/speedtest/client";
export { createSpeedTestJob } from "@/lib/speedtest/jobs";
export { PrismaSpeedTestJobQueue } from "@/lib/speedtest/prisma-queue";
export {
  claimNextPendingJob,
  processNextJob,
  runWorkerLoop,
} from "@/lib/speedtest/worker";
export {
  applyStatusTransition,
  extendJobLease,
  reapExpiredLeases,
} from "@/lib/speedtest/transitions";
export { mockSpeedTestExecutor, MockSpeedTestExecutor } from "@/lib/speedtest/mock-executor";
export {
  createRealSpeedTestExecutor,
  createSpeedTestExecutor,
} from "@/lib/speedtest/executor-factory";
export { RealSpeedTestExecutor } from "@/lib/speedtest/real-executor";
export type { RealSpeedTestExecutorOptions } from "@/lib/speedtest/real-executor";
export {
  REAL_EXECUTOR_NODE_PROTOCOLS,
  assertNoRawConfig,
  isDisallowedNodeTarget,
  isIllegalNodeHost,
  summarizeValidatedNodeConfig,
  toRuntimeNodeInput,
  validateNodeForRealExecutor,
} from "@/lib/speedtest/node-config";
export type {
  NodeConfigSource,
  ValidatedHttpConfig,
  ValidatedNodeConfig,
  ValidatedNodeConfigSummary,
  ValidatedSsConfig,
  ValidatedTrojanConfig,
  ValidatedVlessConfig,
  ValidatedVmessConfig,
} from "@/lib/speedtest/node-config";
export {
  RealSpeedTestPersistence,
  RealSpeedTestResultMapper,
  mapRealSpeedTestResultToPersistence,
} from "@/lib/speedtest/result-persistence";
export type {
  RealSpeedTestJobPersistencePatch,
  RealSpeedTestPersistenceWrite,
  SpeedTestResultPersistenceData,
} from "@/lib/speedtest/result-persistence";
export { SpeedTestEngineError } from "@/lib/speedtest/engine-error";
export {
  REAL_PRODUCTION_GATE_OPEN,
  allowRealSpeedTestResult,
  identitiesLookLikeFixture,
  isPrivateOrDocumentationIp,
  parseObservedIdentity,
  verifyExitIdentity,
} from "@/lib/speedtest/exit-identity";
export type { ExitVerification, ObservedIdentity } from "@/lib/speedtest/exit-identity";
export {
  assertTransition,
  canTransition,
  isSuccessfulStatus,
} from "@/lib/speedtest/state-machine";
export { SpeedTestJobError } from "@/lib/speedtest/errors";
export {
  BYTE_CAPS,
  aggregateWallClockThroughput,
  applyByteCap,
  clampConcurrency,
  classifyEngineError,
  engineErrorMessage,
  isEngineErrorCode,
  packetLossPercent,
  remainingByteBudget,
  successRatePercent,
  summarizeLatency,
  throughputMbps,
} from "@/lib/speedtest/metrics";
export type {
  AggregateTransfer,
  ByteCapResult,
  EngineErrorCode,
  LatencyStats,
  ThroughputResult,
  TransferSample,
} from "@/lib/speedtest/metrics";
export {
  PUBLIC_SPEEDTEST_HIDDEN_KEYS,
  SPEED_TEST_STAGES,
  SPEED_TEST_STAGE_STATUSES,
  hashSpeedTestIdentity,
  sanitizeEngineErrorCode,
  sanitizeSkippedStages,
  sanitizeStageStatus,
} from "@/lib/speedtest/raw-metrics";
export type {
  SpeedTestStageName,
  SpeedTestStageStatusName,
} from "@/lib/speedtest/raw-metrics";
