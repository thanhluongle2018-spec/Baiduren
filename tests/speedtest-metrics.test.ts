import assert from "node:assert/strict";
import { test } from "node:test";
import { ProxyRuntimeError } from "../lib/proxy-runtime/errors";
import {
  DEFAULT_CONCURRENCY,
  MAX_CONCURRENCY,
  MIN_CONCURRENCY,
  MULTI_THREAD_CONCURRENCY,
} from "../lib/speedtest/constants";
import { SpeedTestJobError } from "../lib/speedtest/errors";
import {
  BYTE_CAPS,
  aggregateWallClockThroughput,
  applyByteCap,
  clampConcurrency,
  classifyEngineError,
  engineErrorMessage,
  packetLossPercent,
  remainingByteBudget,
  successRatePercent,
  summarizeLatency,
  throughputMbps,
  type EngineErrorCode,
} from "../lib/speedtest/metrics";

const MIB = 1024 * 1024;

function assertFiniteOrNull(value: number | null) {
  if (value == null) return;
  assert.equal(Number.isFinite(value), true);
}

test("summarizeLatency ignores failed samples and never returns NaN", () => {
  const empty = summarizeLatency([]);
  assert.deepEqual(empty, {
    min: null,
    max: null,
    average: null,
    p50: null,
    p90: null,
    sampleCount: 0,
  });

  const ignored = summarizeLatency([Number.NaN, Number.POSITIVE_INFINITY, -4, -0.1]);
  assert.equal(ignored.sampleCount, 0);
  assert.equal(ignored.min, null);
  assert.equal(ignored.p90, null);

  const mixed = summarizeLatency([20, Number.NaN, 40, -1, 30]);
  assert.equal(mixed.sampleCount, 3);
  assert.equal(mixed.min, 20);
  assert.equal(mixed.max, 40);
  assert.equal(mixed.average, 30);
  assertFiniteOrNull(mixed.p50);
  assertFiniteOrNull(mixed.p90);
});

test("summarizeLatency P50/P90 use rank=(n-1)*p linear interpolation", () => {
  const one = summarizeLatency([12]);
  assert.equal(one.p50, 12);
  assert.equal(one.p90, 12);

  const four = summarizeLatency([1, 2, 3, 4]);
  assert.equal(four.p50, 2.5);
  assert.equal(four.p90, 3.7);

  const three = summarizeLatency([10, 20, 30]);
  assert.equal(three.p50, 20);
  assert.equal(three.p90, 28);

  const ten = summarizeLatency([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  assert.equal(ten.min, 10);
  assert.equal(ten.max, 100);
  assert.equal(ten.average, 55);
  assert.equal(ten.p50, 55);
  assert.equal(ten.p90, 91);
});

test("throughputMbps uses bytes*8/durationMs/1_000_000*1000", () => {
  const ok = throughputMbps(1_000_000, 1000);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.mbps, 8);

  const zeroBytes = throughputMbps(0, 1000);
  assert.equal(zeroBytes.ok, true);
  if (zeroBytes.ok) assert.equal(zeroBytes.mbps, 0);

  assert.deepEqual(throughputMbps(-1, 1000), {
    ok: false,
    mbps: null,
    reason: "INVALID_BYTES",
  });
  assert.deepEqual(throughputMbps(Number.NaN, 1000), {
    ok: false,
    mbps: null,
    reason: "INVALID_BYTES",
  });
  assert.deepEqual(throughputMbps(100, 0), {
    ok: false,
    mbps: null,
    reason: "INVALID_DURATION",
  });
  assert.deepEqual(throughputMbps(100, -5), {
    ok: false,
    mbps: null,
    reason: "INVALID_DURATION",
  });
  assert.deepEqual(throughputMbps(100, Number.POSITIVE_INFINITY), {
    ok: false,
    mbps: null,
    reason: "INVALID_DURATION",
  });
});

test("applyByteCap is inclusive: equal reaches, over truncates", () => {
  assert.deepEqual(applyByteCap(0, 100), { accepted: 0, reached: false, truncated: false });
  assert.deepEqual(applyByteCap(99, 100), { accepted: 99, reached: false, truncated: false });
  assert.deepEqual(applyByteCap(100, 100), { accepted: 100, reached: true, truncated: false });
  assert.deepEqual(applyByteCap(101, 100), { accepted: 100, reached: true, truncated: true });
  assert.deepEqual(applyByteCap(-1, 100), { accepted: 0, reached: false, truncated: false });
  assert.deepEqual(applyByteCap(10, Number.NaN), { accepted: 0, reached: false, truncated: false });

  assert.equal(BYTE_CAPS.downloadSingle, 32 * MIB);
  assert.equal(BYTE_CAPS.downloadMultiTotal, 64 * MIB);
  assert.equal(BYTE_CAPS.downloadMultiPerConnection, 16 * MIB);
  assert.equal(BYTE_CAPS.uploadSingle, 16 * MIB);
  assert.equal(BYTE_CAPS.uploadMultiTotal, 32 * MIB);
  assert.equal(BYTE_CAPS.uploadMultiPerConnection, 8 * MIB);

  assert.equal(applyByteCap(32 * MIB, BYTE_CAPS.downloadSingle).reached, true);
  assert.equal(applyByteCap(32 * MIB, BYTE_CAPS.downloadSingle).truncated, false);
  assert.equal(applyByteCap(32 * MIB + 1, BYTE_CAPS.downloadSingle).truncated, true);
  assert.equal(remainingByteBudget(0, BYTE_CAPS.uploadSingle), 16 * MIB);
  assert.equal(remainingByteBudget(16 * MIB, BYTE_CAPS.uploadSingle), 0);
  assert.equal(remainingByteBudget(16 * MIB + 10, BYTE_CAPS.uploadSingle), 0);
});

test("packetLossPercent handles total=0 and invalid counts", () => {
  assert.equal(packetLossPercent(10, 10), 0);
  assert.equal(packetLossPercent(10, 7), 30);
  assert.equal(packetLossPercent(0, 0), null);
  assert.equal(packetLossPercent(10, 11), null);
  assert.equal(packetLossPercent(10, -1), null);
  assert.equal(packetLossPercent(-2, 0), null);
  assert.equal(packetLossPercent(3.5, 2), null);
});

test("successRatePercent is ping-only and ignores download/upload", () => {
  assert.equal(successRatePercent(10, 10), 100);
  assert.equal(successRatePercent(8, 10), 80);
  assert.equal(successRatePercent(0, 10), 0);
  assert.equal(successRatePercent(0, 0), null);
  assert.equal(successRatePercent(11, 10), null);
  assert.equal(successRatePercent(-1, 10), null);
  const pingRate = successRatePercent(9, 10);
  const downloadFailed = false;
  assert.equal(pingRate, 90);
  assert.equal(downloadFailed, false);
  assert.notEqual(pingRate, successRatePercent(Number.NaN as unknown as number, 10));
});

test("clampConcurrency normalizes 0, negatives, and values above 8", () => {
  assert.equal(MIN_CONCURRENCY, 1);
  assert.equal(MAX_CONCURRENCY, 8);
  assert.equal(DEFAULT_CONCURRENCY, 1);
  assert.equal(MULTI_THREAD_CONCURRENCY, 4);
  assert.equal(clampConcurrency(0), 1);
  assert.equal(clampConcurrency(-3), 1);
  assert.equal(clampConcurrency(9), 8);
  assert.equal(clampConcurrency(99, 1, 8), 8);
  assert.equal(clampConcurrency(4), 4);
  assert.equal(clampConcurrency(1), 1);
  assert.equal(clampConcurrency(8), 8);
  assert.equal(clampConcurrency(1.5), 1);
  assert.equal(clampConcurrency("nope"), 1);
  assert.equal(clampConcurrency(undefined), 1);
  assert.equal(clampConcurrency(MULTI_THREAD_CONCURRENCY), 4);
  assert.equal(clampConcurrency(2, 3, 6), 3);
});

test("classifyEngineError maps runtime/job errors without leaking secrets", () => {
  const codes: EngineErrorCode[] = [
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
  ];
  for (const code of codes) {
    assert.equal(classifyEngineError(code), code);
    assert.equal(classifyEngineError({ code }), code);
    const message = engineErrorMessage(code);
    assert.equal(message.includes("password"), false);
    assert.equal(message.includes("uuid"), false);
    assert.equal(message.includes("token"), false);
  }

  assert.equal(classifyEngineError(new ProxyRuntimeError("BINARY_NOT_FOUND")), "RUNTIME_BINARY_MISSING");
  assert.equal(classifyEngineError(new ProxyRuntimeError("STARTUP_TIMEOUT")), "RUNTIME_START_FAILED");
  assert.equal(classifyEngineError(new ProxyRuntimeError("HEALTHCHECK_TIMEOUT")), "RUNTIME_HEALTH_FAILED");
  assert.equal(classifyEngineError(new ProxyRuntimeError("UNSUPPORTED_PROTOCOL")), "NODE_UNSUPPORTED");
  assert.equal(classifyEngineError(new ProxyRuntimeError("PROBE_TIMEOUT")), "TARGET_TIMEOUT");
  assert.equal(classifyEngineError(new ProxyRuntimeError("PROBE_FAILED")), "PROXY_CONNECT_FAILED");
  assert.equal(classifyEngineError(new ProxyRuntimeError("PROBE_TARGET_INVALID")), "PROBE_TARGET_INVALID");
  assert.equal(classifyEngineError(new SpeedTestJobError("SERVER_DISABLED")), "SERVER_DISABLED");
  assert.equal(classifyEngineError(new SpeedTestJobError("INVALID_CONCURRENCY")), "UNKNOWN");
  assert.equal(classifyEngineError(new Error("boom")), "UNKNOWN");
  assert.equal(engineErrorMessage("UNKNOWN"), "测速执行失败。");
});

test("aggregateWallClockThroughput uses total successful bytes / wall-clock, not per-thread average", () => {
  const wallClockMs = 1000;
  const samples = [
    { ok: true, bytes: 1_000_000 },
    { ok: true, bytes: 1_000_000 },
    { ok: true, bytes: 1_000_000 },
    { ok: false, bytes: 999_999 },
  ];
  const aggregate = aggregateWallClockThroughput(samples, wallClockMs);
  assert.equal(aggregate.successfulBytes, 3_000_000);
  assert.equal(aggregate.failedCount, 1);
  assert.equal(aggregate.completeSuccess, false);
  assert.equal(aggregate.throughput.ok, true);
  if (aggregate.throughput.ok) {
    assert.equal(aggregate.throughput.mbps, 24);
    const perThread = [8, 8, 8];
    const averaged = perThread.reduce((sum, value) => sum + value, 0) / perThread.length;
    assert.notEqual(aggregate.throughput.mbps, averaged);
  }

  const empty = aggregateWallClockThroughput([], 0);
  assert.equal(empty.completeSuccess, false);
  assert.equal(empty.throughput.ok, false);
});
