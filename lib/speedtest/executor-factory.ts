import { mockSpeedTestExecutor } from "@/lib/speedtest/mock-executor";
import { RealSpeedTestExecutor } from "@/lib/speedtest/real-executor";
import type { RealSpeedTestExecutorOptions } from "@/lib/speedtest/real-executor";
import type { SpeedTestExecutor } from "@/lib/speedtest/types";

/** Production Worker factory. C1 always returns the mock executor. */
export function createSpeedTestExecutor(): SpeedTestExecutor {
  return mockSpeedTestExecutor;
}

export function createRealSpeedTestExecutor(options: RealSpeedTestExecutorOptions) {
  return new RealSpeedTestExecutor(options);
}
