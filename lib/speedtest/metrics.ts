import {
  DEFAULT_CONCURRENCY,
  MAX_CONCURRENCY,
  MIN_CONCURRENCY,
} from "@/lib/speedtest/constants";
import {
  SpeedTestJobError,
  type SpeedTestErrorCode,
} from "@/lib/speedtest/errors";
import {
  ProxyRuntimeError,
  type ProxyRuntimeErrorCode,
} from "@/lib/proxy-runtime/errors";

const MIB = 1024 * 1024;

/** Inclusive byte caps for 3b3-v1. Hitting the cap is allowed; going past is truncated. */
export const BYTE_CAPS = {
  downloadSingle: 32 * MIB,
  downloadMultiTotal: 64 * MIB,
  downloadMultiPerConnection: 16 * MIB,
  uploadSingle: 16 * MIB,
  uploadMultiTotal: 32 * MIB,
  uploadMultiPerConnection: 8 * MIB,
} as const;

export type LatencyStats = {
  min: number | null;
  max: number | null;
  average: number | null;
  p50: number | null;
  p90: number | null;
  sampleCount: number;
};

export type ThroughputResult =
  | { ok: true; mbps: number }
  | { ok: false; mbps: null; reason: "INVALID_BYTES" | "INVALID_DURATION" };

export type ByteCapResult = {
  accepted: number;
  reached: boolean;
  truncated: boolean;
};

export type EngineErrorCode =
  | "RUNTIME_START_FAILED"
  | "RUNTIME_HEALTH_FAILED"
  | "RUNTIME_BINARY_MISSING"
  | "NODE_UNSUPPORTED"
  | "NODE_AUTH_FAILED"
  | "PROXY_CONNECT_FAILED"
  | "EXIT_IP_UNVERIFIED"
  | "TARGET_TIMEOUT"
  | "TARGET_HTTP_ERROR"
  | "DOWNLOAD_TIMEOUT"
  | "UPLOAD_TIMEOUT"
  | "SERVER_ERROR"
  | "BYTE_CAP_REACHED"
  | "SERVER_DISABLED"
  | "AIRPORT_CONCURRENCY"
  | "NODE_CONCURRENCY"
  | "AIRPORT_BUDGET_EXCEEDED"
  | "TEST_CANCELLED"
  | "LEASE_TIMEOUT"
  | "PROBE_TARGET_INVALID"
  | "INVALID_NODE"
  | "UNKNOWN";

const ENGINE_CODES = new Set<string>([
  "RUNTIME_START_FAILED",
  "RUNTIME_HEALTH_FAILED",
  "RUNTIME_BINARY_MISSING",
  "NODE_UNSUPPORTED",
  "NODE_AUTH_FAILED",
  "PROXY_CONNECT_FAILED",
  "EXIT_IP_UNVERIFIED",
  "TARGET_TIMEOUT",
  "TARGET_HTTP_ERROR",
  "DOWNLOAD_TIMEOUT",
  "UPLOAD_TIMEOUT",
  "SERVER_ERROR",
  "BYTE_CAP_REACHED",
  "SERVER_DISABLED",
  "AIRPORT_CONCURRENCY",
  "NODE_CONCURRENCY",
  "AIRPORT_BUDGET_EXCEEDED",
  "TEST_CANCELLED",
  "LEASE_TIMEOUT",
  "PROBE_TARGET_INVALID",
  "INVALID_NODE",
]);

export function isEngineErrorCode(value: unknown): value is EngineErrorCode {
  return typeof value === "string" && (ENGINE_CODES.has(value) || value === "UNKNOWN");
}

const PROXY_TO_ENGINE: Partial<Record<ProxyRuntimeErrorCode, EngineErrorCode>> = {
  BINARY_NOT_FOUND: "RUNTIME_BINARY_MISSING",
  STARTUP_TIMEOUT: "RUNTIME_START_FAILED",
  PROCESS_CRASH: "RUNTIME_START_FAILED",
  HEALTHCHECK_TIMEOUT: "RUNTIME_HEALTH_FAILED",
  UNSUPPORTED_PROTOCOL: "NODE_UNSUPPORTED",
  INVALID_NODE: "INVALID_NODE",
  PROBE_TIMEOUT: "TARGET_TIMEOUT",
  PROBE_FAILED: "PROXY_CONNECT_FAILED",
  PROBE_TARGET_INVALID: "PROBE_TARGET_INVALID",
  NOT_RUNNING: "PROXY_CONNECT_FAILED",
  PORT_UNAVAILABLE: "RUNTIME_START_FAILED",
  CLEANUP_FAILED: "RUNTIME_START_FAILED",
};

const JOB_TO_ENGINE: Partial<Record<SpeedTestErrorCode, EngineErrorCode>> = {
  SERVER_DISABLED: "SERVER_DISABLED",
  INVALID_CONCURRENCY: "UNKNOWN",
  DEMO_ONLY: "UNKNOWN",
};

function finiteSamples(values: number[]) {
  return values.filter((value) => Number.isFinite(value) && value >= 0);
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return null;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const left = sorted[lower];
  const right = sorted[upper];
  if (left == null) return null;
  if (lower === upper || right == null) return left;
  const weight = index - lower;
  return left * (1 - weight) + right * weight;
}

function round(value: number, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Latency stats from successful samples only.
 * Empty input returns nulls, never NaN/Infinity.
 * P50/P90 use rank = (n - 1) * p with linear interpolation.
 */
export function summarizeLatency(samples: number[]): LatencyStats {
  const valid = finiteSamples(samples);
  if (valid.length === 0) {
    return {
      min: null,
      max: null,
      average: null,
      p50: null,
      p90: null,
      sampleCount: 0,
    };
  }
  const sorted = [...valid].sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);
  return {
    min: sorted[0] ?? null,
    max: sorted[sorted.length - 1] ?? null,
    average: round(sum / sorted.length, 6),
    p50: round(percentile(sorted, 0.5) ?? 0, 6),
    p90: round(percentile(sorted, 0.9) ?? 0, 6),
    sampleCount: sorted.length,
  };
}

/**
 * Mbps = bytes * 8 / durationMs / 1_000_000 * 1000
 */
export function throughputMbps(bytes: number, durationMs: number): ThroughputResult {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return { ok: false, mbps: null, reason: "INVALID_BYTES" };
  }
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return { ok: false, mbps: null, reason: "INVALID_DURATION" };
  }
  const mbps = (bytes * 8) / durationMs / 1_000_000 * 1000;
  if (!Number.isFinite(mbps)) {
    return { ok: false, mbps: null, reason: "INVALID_DURATION" };
  }
  return { ok: true, mbps: round(mbps, 6) };
}

/**
 * Inclusive cap: accepted = min(bytes, cap).
 * bytes === cap → reached, not truncated.
 * bytes > cap → reached and truncated.
 */
export function applyByteCap(bytes: number, cap: number): ByteCapResult {
  if (!Number.isFinite(bytes) || bytes < 0 || !Number.isFinite(cap) || cap < 0) {
    return { accepted: 0, reached: false, truncated: false };
  }
  if (bytes < cap) {
    return { accepted: bytes, reached: false, truncated: false };
  }
  return {
    accepted: cap,
    reached: true,
    truncated: bytes > cap,
  };
}

export function remainingByteBudget(used: number, cap: number) {
  if (!Number.isFinite(used) || !Number.isFinite(cap)) return 0;
  return Math.max(0, cap - Math.max(0, used));
}

export type TransferSample = {
  ok: boolean;
  bytes: number;
};

export type AggregateTransfer = {
  successfulBytes: number;
  failedCount: number;
  attemptCount: number;
  completeSuccess: boolean;
  throughput: ThroughputResult;
};

/**
 * Multi-thread aggregate uses total successful bytes / wall-clock ms.
 * Do not average per-connection Mbps.
 */
export function aggregateWallClockThroughput(
  samples: TransferSample[],
  wallClockMs: number
): AggregateTransfer {
  const successfulBytes = samples
    .filter((sample) => sample.ok)
    .reduce((total, sample) => total + Math.max(0, sample.bytes), 0);
  const failedCount = samples.filter((sample) => !sample.ok).length;
  return {
    successfulBytes,
    failedCount,
    attemptCount: samples.length,
    completeSuccess: samples.length > 0 && failedCount === 0,
    throughput: throughputMbps(successfulBytes, wallClockMs),
  };
}

export function packetLossPercent(total: number, success: number): number | null {
  if (!Number.isInteger(total) || total < 0) return null;
  if (!Number.isInteger(success) || success < 0 || success > total) return null;
  if (total === 0) return null;
  return round(((total - success) / total) * 100, 6);
}

/** Ping-only success rate. Do not mix download/upload into this. */
export function successRatePercent(pingSuccessCount: number, pingTotal: number): number | null {
  if (!Number.isInteger(pingTotal) || pingTotal < 0) return null;
  if (
    !Number.isInteger(pingSuccessCount) ||
    pingSuccessCount < 0 ||
    pingSuccessCount > pingTotal
  ) {
    return null;
  }
  if (pingTotal === 0) return null;
  return round((pingSuccessCount / pingTotal) * 100, 6);
}

export function clampConcurrency(
  requested: unknown,
  min = MIN_CONCURRENCY,
  max = MAX_CONCURRENCY
) {
  if (min > max) return min;
  if (requested == null || requested === "") return Math.min(Math.max(DEFAULT_CONCURRENCY, min), max);
  const value = typeof requested === "number" ? requested : Number(requested);
  if (!Number.isInteger(value)) {
    return min;
  }
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function classifyEngineError(error: unknown): EngineErrorCode {
  if (typeof error === "string" && ENGINE_CODES.has(error)) {
    return error as EngineErrorCode;
  }
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code: unknown }).code);
    if (ENGINE_CODES.has(code)) return code as EngineErrorCode;
    if (error instanceof ProxyRuntimeError) {
      return PROXY_TO_ENGINE[error.code] ?? "UNKNOWN";
    }
    if (error instanceof SpeedTestJobError) {
      return JOB_TO_ENGINE[error.code] ?? "UNKNOWN";
    }
  }
  return "UNKNOWN";
}

export function engineErrorMessage(code: EngineErrorCode) {
  switch (code) {
    case "RUNTIME_START_FAILED":
      return "代理运行时启动失败。";
    case "RUNTIME_HEALTH_FAILED":
      return "代理运行时健康检查失败。";
    case "RUNTIME_BINARY_MISSING":
      return "未找到 Mihomo 可执行文件。";
    case "NODE_UNSUPPORTED":
      return "节点协议不受支持。";
    case "NODE_AUTH_FAILED":
      return "节点认证失败。";
    case "PROXY_CONNECT_FAILED":
      return "无法连接本地代理入口。";
    case "EXIT_IP_UNVERIFIED":
      return "无法证明请求经过机场节点。";
    case "TARGET_TIMEOUT":
      return "测速目标超时。";
    case "TARGET_HTTP_ERROR":
      return "测速目标返回 HTTP 错误。";
    case "DOWNLOAD_TIMEOUT":
      return "下载测速超时。";
    case "UPLOAD_TIMEOUT":
      return "上传测速超时。";
    case "SERVER_ERROR":
      return "测速服务器错误。";
    case "BYTE_CAP_REACHED":
      return "已达到本次测速流量上限。";
    case "SERVER_DISABLED":
      return "测速服务器已停用，无法创建或执行任务。";
    case "AIRPORT_CONCURRENCY":
      return "机场并发测速已达上限。";
    case "NODE_CONCURRENCY":
      return "该节点已有测速任务在执行。";
    case "AIRPORT_BUDGET_EXCEEDED":
      return "机场测速流量预算已用尽。";
    case "TEST_CANCELLED":
      return "测速任务已取消。";
    case "LEASE_TIMEOUT":
      return "测速任务租约超时，已停止。";
    case "PROBE_TARGET_INVALID":
      return "连通性验证目标不合法。";
    case "INVALID_NODE":
      return "节点配置不完整，无法启动 Runtime。";
    default:
      return "测速执行失败。";
  }
}
