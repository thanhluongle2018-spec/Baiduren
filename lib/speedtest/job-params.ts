import {
  DEFAULT_LATENCY_ATTEMPTS,
  DEFAULT_PING_TIMEOUT_MS,
  SPEED_TEST_VERSION,
} from "@/lib/speedtest/constants";
import { BYTE_CAPS } from "@/lib/speedtest/metrics";

export type SpeedTestJobParamSnapshot = {
  testVersion: string;
  latencyAttempts: number;
  pingTimeoutMs: number;
  downloadConcurrency: number;
  uploadConcurrency: number;
  singleDownloadCapBytes: number;
  multiDownloadCapBytes: number;
  singleUploadCapBytes: number;
  multiUploadCapBytes: number;
  totalTrafficCapBytes: number;
  serverMaxConcurrencySnapshot: number;
  serverBandwidthMbpsSnapshot: number;
  nodeConcurrencySnapshot: number;
  airportConcurrencySnapshot: number;
};

export function totalTrafficCapBytes() {
  return (
    BYTE_CAPS.downloadSingle +
    BYTE_CAPS.downloadMultiTotal +
    BYTE_CAPS.uploadSingle +
    BYTE_CAPS.uploadMultiTotal
  );
}

/**
 * Parameter + capacity snapshot stored on SpeedTest at enqueue time.
 * Never includes node credentials, rawConfig, or probe URLs.
 */
export function buildJobParamSnapshot(input: {
  concurrency: number;
  airportMaxConcurrentTests: number;
  nodeMaxConcurrentTests: number;
  serverMaxConcurrentTests: number;
  serverBandwidthMbps: number;
}): SpeedTestJobParamSnapshot {
  return {
    testVersion: SPEED_TEST_VERSION,
    latencyAttempts: DEFAULT_LATENCY_ATTEMPTS,
    pingTimeoutMs: DEFAULT_PING_TIMEOUT_MS,
    downloadConcurrency: input.concurrency,
    uploadConcurrency: input.concurrency,
    singleDownloadCapBytes: BYTE_CAPS.downloadSingle,
    multiDownloadCapBytes: BYTE_CAPS.downloadMultiTotal,
    singleUploadCapBytes: BYTE_CAPS.uploadSingle,
    multiUploadCapBytes: BYTE_CAPS.uploadMultiTotal,
    totalTrafficCapBytes: totalTrafficCapBytes(),
    serverMaxConcurrencySnapshot: input.serverMaxConcurrentTests,
    serverBandwidthMbpsSnapshot: input.serverBandwidthMbps,
    nodeConcurrencySnapshot: input.nodeMaxConcurrentTests,
    airportConcurrencySnapshot: input.airportMaxConcurrentTests,
  };
}
