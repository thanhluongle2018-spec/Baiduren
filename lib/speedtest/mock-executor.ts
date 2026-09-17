import type {
  ClaimedSpeedTestJob,
  MockSpeedTestMetrics,
  SpeedTestExecutor,
} from "@/lib/speedtest/types";

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Simulated metrics only. Does not open sockets, proxies, or subscriptions.
 * Ranges are for plumbing tests and must not be treated as airport performance.
 */
export function simulateMetrics(concurrency: number): MockSpeedTestMetrics {
  const latencyMs = round(randomBetween(20, 180), 1);
  const jitter = randomBetween(2, 18);
  const downloadSingleMbps = round(randomBetween(20, 150), 2);
  const downloadMultiMbps = round(
    Math.max(downloadSingleMbps, randomBetween(50, 500)),
    2
  );
  const uploadSingleMbps = round(randomBetween(10, 100), 2);
  const uploadMultiMbps = round(
    Math.max(uploadSingleMbps, randomBetween(20, 200)),
    2
  );
  const packetLossPercent = round(randomBetween(0, 5), 2);
  const successRatePercent = round(randomBetween(90, 100), 2);

  return {
    latencyMs,
    minLatencyMs: round(Math.max(20, latencyMs - jitter), 1),
    maxLatencyMs: round(Math.min(180, latencyMs + jitter), 1),
    downloadSingleMbps,
    downloadMultiMbps,
    uploadSingleMbps,
    uploadMultiMbps,
    packetLossPercent,
    successRatePercent,
    stability: round(Math.max(70, 100 - packetLossPercent * 4), 1),
    singleThread: concurrency <= 1,
    isDemo: true,
  };
}

export class MockSpeedTestExecutor implements SpeedTestExecutor {
  readonly kind = "mock" as const;

  async run(job: ClaimedSpeedTestJob): Promise<MockSpeedTestMetrics> {
    return simulateMetrics(job.concurrency);
  }
}

export const mockSpeedTestExecutor = new MockSpeedTestExecutor();
