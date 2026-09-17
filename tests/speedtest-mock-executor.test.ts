import assert from "node:assert/strict";
import { test } from "node:test";
import { simulateMetrics } from "../lib/speedtest/mock-executor";

test("mock executor stays within documented demo ranges", () => {
  for (let i = 0; i < 40; i += 1) {
    const metrics = simulateMetrics(i % 2 === 0 ? 1 : 4);
    assert.ok(metrics.latencyMs >= 20 && metrics.latencyMs <= 180);
    assert.ok(metrics.minLatencyMs >= 20 && metrics.minLatencyMs <= metrics.latencyMs);
    assert.ok(metrics.maxLatencyMs >= metrics.latencyMs && metrics.maxLatencyMs <= 180);
    assert.ok(metrics.downloadSingleMbps >= 20 && metrics.downloadSingleMbps <= 150);
    assert.ok(metrics.downloadMultiMbps >= 50 && metrics.downloadMultiMbps <= 500);
    assert.ok(metrics.downloadMultiMbps >= metrics.downloadSingleMbps);
    assert.ok(metrics.uploadSingleMbps >= 10 && metrics.uploadSingleMbps <= 100);
    assert.ok(metrics.uploadMultiMbps >= 20 && metrics.uploadMultiMbps <= 200);
    assert.ok(metrics.packetLossPercent >= 0 && metrics.packetLossPercent <= 5);
    assert.ok(metrics.successRatePercent >= 90 && metrics.successRatePercent <= 100);
    assert.equal(metrics.isDemo, true);
    assert.equal(metrics.singleThread, i % 2 === 0);
  }
});
