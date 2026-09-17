import { createHash } from "node:crypto";
import { isEngineErrorCode, type EngineErrorCode } from "@/lib/speedtest/metrics";

export const SPEED_TEST_STAGES = [
  "LATENCY",
  "PACKET_LOSS",
  "SINGLE_DOWNLOAD",
  "MULTI_DOWNLOAD",
  "SINGLE_UPLOAD",
  "MULTI_UPLOAD",
  "COMPLETE",
] as const;

export type SpeedTestStageName = (typeof SPEED_TEST_STAGES)[number];

export const SPEED_TEST_STAGE_STATUSES = [
  "SUCCESS",
  "PARTIAL",
  "TIMEOUT",
  "FAILED",
  "SKIPPED",
] as const;

export type SpeedTestStageStatusName = (typeof SPEED_TEST_STAGE_STATUSES)[number];

const STAGE_SET = new Set<string>(SPEED_TEST_STAGES);
const STATUS_SET = new Set<string>(SPEED_TEST_STAGE_STATUSES);

const IDENTITY_HASH_PREFIX = "baiduren-exit-v1:";

/** sha256 of a fixture/real identity string. Never store the plaintext IP. */
export function hashSpeedTestIdentity(value: string) {
  return createHash("sha256").update(`${IDENTITY_HASH_PREFIX}${value}`).digest("hex");
}

export function isSpeedTestStage(value: unknown): value is SpeedTestStageName {
  return typeof value === "string" && STAGE_SET.has(value);
}

export function isSpeedTestStageStatus(value: unknown): value is SpeedTestStageStatusName {
  return typeof value === "string" && STATUS_SET.has(value);
}

/**
 * JSON skipped-stages payload: a string array of SpeedTestStage names.
 * Unknown values are dropped so secrets/rawConfig cannot sneak in.
 */
export function sanitizeSkippedStages(value: unknown): SpeedTestStageName[] | null {
  if (value == null) return null;
  if (!Array.isArray(value)) return null;
  return value.filter(isSpeedTestStage);
}

export function sanitizeStageStatus(value: unknown): SpeedTestStageStatusName | null {
  return isSpeedTestStageStatus(value) ? value : null;
}

export function sanitizeEngineErrorCode(value: unknown): EngineErrorCode | null {
  if (typeof value === "string") {
    return isEngineErrorCode(value) ? value : null;
  }
  if (value && typeof value === "object" && "code" in value) {
    const code = (value as { code: unknown }).code;
    return typeof code === "string" && isEngineErrorCode(code) ? code : null;
  }
  return null;
}

export const PUBLIC_SPEEDTEST_HIDDEN_KEYS = [
  "directIdentityHash",
  "proxiedIdentityHash",
  "rawConfig",
] as const;
