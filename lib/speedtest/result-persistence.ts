/**
 * C2: RealSpeedTestRawResult → SpeedTestResult persistence adapter.
 * Does not call the Worker, claim, lease, heartbeat, or status transitions.
 */

import { engineErrorMessage } from "@/lib/speedtest/metrics";
import {
  isSpeedTestStage,
  sanitizeEngineErrorCode,
  sanitizeSkippedStages,
  sanitizeStageStatus,
  type SpeedTestStageName,
  type SpeedTestStageStatusName,
} from "@/lib/speedtest/raw-metrics";
import type { RealSpeedTestRawResult } from "@/lib/speedtest/types";
import { redactSecrets } from "@/lib/subscription/secrets";

const SHA256_HEX = /^[a-f0-9]{64}$/i;

export type SpeedTestResultPersistenceData = {
  latencyMs: number | null;
  minLatencyMs: number | null;
  maxLatencyMs: number | null;
  latencyAvgMs: number | null;
  latencyP50Ms: number | null;
  latencyP90Ms: number | null;
  latencyAttempts: number | null;
  latencySuccessCount: number | null;
  downloadMbps: number | null;
  downloadSingleMbps: number | null;
  downloadMultiMbps: number | null;
  uploadMbps: number | null;
  uploadSingleMbps: number | null;
  uploadMultiMbps: number | null;
  packetLoss: number | null;
  packetLossPercent: number | null;
  packetLossTotal: number | null;
  packetLossSuccess: number | null;
  successRate: number | null;
  successRatePercent: number | null;
  successRateTotal: number | null;
  successRateSuccess: number | null;
  stability: null;
  singleDownloadBytes: number | null;
  singleDownloadDurationMs: number | null;
  singleDownloadStatus: SpeedTestStageStatusName | null;
  multiDownloadBytes: number | null;
  multiDownloadDurationMs: number | null;
  multiDownloadConcurrency: number | null;
  multiDownloadStatus: SpeedTestStageStatusName | null;
  singleUploadBytes: number | null;
  singleUploadDurationMs: number | null;
  singleUploadStatus: SpeedTestStageStatusName | null;
  multiUploadBytes: number | null;
  multiUploadDurationMs: number | null;
  multiUploadConcurrency: number | null;
  multiUploadStatus: SpeedTestStageStatusName | null;
  skippedStages: SpeedTestStageName[] | null;
  errorCode: string | null;
  errorMessage: string | null;
  exitVerified: false;
  directIdentityHash: string | null;
  proxiedIdentityHash: string | null;
  singleThread: boolean;
  testedAt: Date;
  isDemo: true;
};

export type RealSpeedTestJobPersistencePatch = {
  currentStage: SpeedTestStageName | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export type RealSpeedTestPersistenceWrite = {
  result: SpeedTestResultPersistenceData;
  job: RealSpeedTestJobPersistencePatch;
};

function measuredNumber(value: number | null | undefined): number | null {
  if (value == null) return null;
  return Number.isFinite(value) ? value : null;
}

function measuredInt(value: number | null | undefined): number | null {
  const numeric = measuredNumber(value);
  if (numeric == null) return null;
  return Number.isInteger(numeric) ? numeric : Math.trunc(numeric);
}

function persistConcurrency(value: number | null | undefined): number | null {
  const numeric = measuredInt(value);
  if (numeric == null || numeric < 1 || numeric > 8) return null;
  return numeric;
}

function persistIdentityHash(value: string | null | undefined): string | null {
  if (typeof value !== "string" || !SHA256_HEX.test(value)) return null;
  return value.toLowerCase();
}

function persistErrorMessage(
  code: ReturnType<typeof sanitizeEngineErrorCode>,
  message: string | null | undefined
): string | null {
  if (code) return engineErrorMessage(code);
  if (!message) return null;
  const redacted = redactSecrets(message).trim();
  return redacted.length > 0 ? redacted : null;
}

function stageSkipped(
  skipped: Set<SpeedTestStageName>,
  stage: SpeedTestStageName
): boolean {
  return skipped.has(stage);
}

function transferMetrics(
  skipped: boolean,
  status: SpeedTestStageStatusName | null,
  mbps: number | null | undefined,
  bytes: number | null | undefined,
  durationMs: number | null | undefined
): {
  mbps: number | null;
  bytes: number | null;
  durationMs: number | null;
  status: SpeedTestStageStatusName | null;
} {
  if (skipped) {
    return { mbps: null, bytes: null, durationMs: null, status: null };
  }
  const normalized = sanitizeStageStatus(status);
  if (normalized == null) {
    return { mbps: null, bytes: null, durationMs: null, status: null };
  }
  if (normalized === "SKIPPED") {
    return { mbps: null, bytes: null, durationMs: null, status: null };
  }
  if (normalized === "FAILED" || normalized === "TIMEOUT") {
    return { mbps: null, bytes: null, durationMs: null, status: normalized };
  }
  return {
    mbps: measuredNumber(mbps),
    bytes: measuredInt(bytes),
    durationMs: measuredInt(durationMs),
    status: normalized,
  };
}

function parseTestedAt(value: string | null | undefined): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function mapRealSpeedTestResultToPersistence(
  raw: RealSpeedTestRawResult
): RealSpeedTestPersistenceWrite {
  const skippedList = sanitizeSkippedStages(raw.skippedStages) ?? [];
  const skipped = new Set(skippedList.filter((stage) => stage !== "COMPLETE"));
  const errorCode = sanitizeEngineErrorCode(raw.errorCode);
  const errorMessage = persistErrorMessage(errorCode, raw.errorMessage);

  const latencySkipped = stageSkipped(skipped, "LATENCY");
  const packetLossSkipped = latencySkipped || stageSkipped(skipped, "PACKET_LOSS");
  const latencyP50 = latencySkipped ? null : measuredNumber(raw.latencyP50Ms);
  const latencyAvg = latencySkipped ? null : measuredNumber(raw.latencyAvgMs);
  const latencyMin = latencySkipped ? null : measuredNumber(raw.latencyMinMs);
  const latencyMax = latencySkipped ? null : measuredNumber(raw.latencyMaxMs);
  const latencyP90 = latencySkipped ? null : measuredNumber(raw.latencyP90Ms);
  const latencyAttempts = latencySkipped ? null : measuredInt(raw.latencyAttempts);
  const latencySuccessCount = latencySkipped ? null : measuredInt(raw.latencySuccessCount);

  const packetLossPercent = packetLossSkipped ? null : measuredNumber(raw.packetLossPercent);
  const packetLossTotal = packetLossSkipped ? null : measuredInt(raw.packetLossTotal);
  const packetLossSuccess = packetLossSkipped ? null : measuredInt(raw.packetLossSuccess);

  const successRatePercent = latencySkipped ? null : measuredNumber(raw.successRatePercent);
  const successRateTotal = latencySkipped ? null : measuredInt(raw.successRateTotal);
  const successRateSuccess = latencySkipped ? null : measuredInt(raw.successRateSuccess);

  const singleDownload = transferMetrics(
    stageSkipped(skipped, "SINGLE_DOWNLOAD"),
    raw.singleDownloadStatus,
    raw.downloadSingleMbps,
    raw.singleDownloadBytes,
    raw.singleDownloadDurationMs
  );
  const multiDownload = transferMetrics(
    stageSkipped(skipped, "MULTI_DOWNLOAD"),
    raw.multiDownloadStatus,
    raw.downloadMultiMbps,
    raw.multiDownloadBytes,
    raw.multiDownloadDurationMs
  );
  const singleUpload = transferMetrics(
    stageSkipped(skipped, "SINGLE_UPLOAD"),
    raw.singleUploadStatus,
    raw.uploadSingleMbps,
    raw.singleUploadBytes,
    raw.singleUploadDurationMs
  );
  const multiUpload = transferMetrics(
    stageSkipped(skipped, "MULTI_UPLOAD"),
    raw.multiUploadStatus,
    raw.uploadMultiMbps,
    raw.multiUploadBytes,
    raw.multiUploadDurationMs
  );

  const multiDownloadConcurrency = stageSkipped(skipped, "MULTI_DOWNLOAD")
    ? null
    : persistConcurrency(raw.multiDownloadConcurrency);
  const multiUploadConcurrency = stageSkipped(skipped, "MULTI_UPLOAD")
    ? null
    : persistConcurrency(raw.multiUploadConcurrency);

  const downloadMbps = multiDownload.mbps ?? singleDownload.mbps;
  const uploadMbps = multiUpload.mbps ?? singleUpload.mbps;
  const multiRan =
    multiDownload.status != null ||
    multiUpload.status != null ||
    multiDownload.mbps != null ||
    multiUpload.mbps != null;

  const result: SpeedTestResultPersistenceData = {
    latencyMs: latencyP50,
    minLatencyMs: latencyMin,
    maxLatencyMs: latencyMax,
    latencyAvgMs: latencyAvg,
    latencyP50Ms: latencyP50,
    latencyP90Ms: latencyP90,
    latencyAttempts,
    latencySuccessCount,
    downloadMbps,
    downloadSingleMbps: singleDownload.mbps,
    downloadMultiMbps: multiDownload.mbps,
    uploadMbps,
    uploadSingleMbps: singleUpload.mbps,
    uploadMultiMbps: multiUpload.mbps,
    packetLoss: packetLossPercent,
    packetLossPercent,
    packetLossTotal,
    packetLossSuccess,
    successRate: successRatePercent,
    successRatePercent,
    successRateTotal,
    successRateSuccess,
    stability: null,
    singleDownloadBytes: singleDownload.bytes,
    singleDownloadDurationMs: singleDownload.durationMs,
    singleDownloadStatus: singleDownload.status,
    multiDownloadBytes: multiDownload.bytes,
    multiDownloadDurationMs: multiDownload.durationMs,
    multiDownloadConcurrency,
    multiDownloadStatus: multiDownload.status,
    singleUploadBytes: singleUpload.bytes,
    singleUploadDurationMs: singleUpload.durationMs,
    singleUploadStatus: singleUpload.status,
    multiUploadBytes: multiUpload.bytes,
    multiUploadDurationMs: multiUpload.durationMs,
    multiUploadConcurrency,
    multiUploadStatus: multiUpload.status,
    skippedStages: skippedList.filter((stage) => stage !== "COMPLETE"),
    errorCode,
    errorMessage,
    exitVerified: false,
    directIdentityHash: persistIdentityHash(raw.directIdentityHash),
    proxiedIdentityHash: persistIdentityHash(raw.proxiedIdentityHash),
    singleThread: !multiRan,
    testedAt: parseTestedAt(raw.testedAt),
    isDemo: true,
  };

  return {
    result,
    job: {
      currentStage: isSpeedTestStage(raw.currentStage) ? raw.currentStage : null,
      errorCode,
      errorMessage,
    },
  };
}

export const RealSpeedTestPersistence = {
  mapResult: mapRealSpeedTestResultToPersistence,
};

export class RealSpeedTestResultMapper {
  toPersistence(raw: RealSpeedTestRawResult): RealSpeedTestPersistenceWrite {
    return mapRealSpeedTestResultToPersistence(raw);
  }
}
