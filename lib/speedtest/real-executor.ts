import { healthCheckWithTimeout } from "@/lib/proxy-runtime/health";
import type { ProxyRuntime } from "@/lib/proxy-runtime/types";
import { SpeedTestEngineError } from "@/lib/speedtest/engine-error";
import {
  allowRealSpeedTestResult,
  parseObservedIdentity,
  verifyExitIdentity,
} from "@/lib/speedtest/exit-identity";
import {
  localhostDirectGet,
  localhostViaProxy,
} from "@/lib/speedtest/localhost-http";
import {
  classifyEngineError,
  engineErrorMessage,
  packetLossPercent,
  successRatePercent,
  summarizeLatency,
  throughputMbps,
  type EngineErrorCode,
} from "@/lib/speedtest/metrics";
import {
  SPEED_TEST_STAGES,
  type SpeedTestStageName,
} from "@/lib/speedtest/raw-metrics";
import {
  assertNoRawConfig,
  type ValidatedNodeConfig,
} from "@/lib/speedtest/node-config";
import type {
  ClaimedSpeedTestJob,
  RawMetricsExecutor,
  RealSpeedTestRawResult,
} from "@/lib/speedtest/types";

const MEASUREMENT_STAGES: SpeedTestStageName[] = [
  "LATENCY",
  "PACKET_LOSS",
  "SINGLE_DOWNLOAD",
  "MULTI_DOWNLOAD",
  "SINGLE_UPLOAD",
  "MULTI_UPLOAD",
];

export type RealSpeedTestExecutorOptions = {
  createRuntime: (job: ClaimedSpeedTestJob) => ProxyRuntime;
  targetBaseUrl: string;
  stages?: SpeedTestStageName[];
  pingAttempts?: number;
  pingTimeoutMs?: number;
  downloadTimeoutMs?: number;
  uploadTimeoutMs?: number;
  healthCheckTimeoutMs?: number;
  signal?: AbortSignal;
  /**
   * C2 contract: the only node shape this executor may accept.
   * Never pass Node.rawConfig. Unused by run() until a later Worker wiring phase.
   */
  validatedNode?: ValidatedNodeConfig;
};

function emptyResult(): RealSpeedTestRawResult {
  return {
    kind: "real-executor",
    isDemo: true,
    provenance: "unproven",
    exitVerified: false,
    runtimeKind: null,
    runtimeCleanedUp: false,
    currentStage: null,
    skippedStages: [],
    errorCode: null,
    errorMessage: null,
    directIdentityHash: null,
    proxiedIdentityHash: null,
    latencyMs: null,
    latencyMinMs: null,
    latencyMaxMs: null,
    latencyAvgMs: null,
    latencyP50Ms: null,
    latencyP90Ms: null,
    latencyAttempts: null,
    latencySuccessCount: null,
    packetLossPercent: null,
    packetLossTotal: null,
    packetLossSuccess: null,
    successRatePercent: null,
    successRateTotal: null,
    successRateSuccess: null,
    downloadSingleMbps: null,
    singleDownloadBytes: null,
    singleDownloadDurationMs: null,
    singleDownloadStatus: null,
    downloadMultiMbps: null,
    multiDownloadBytes: null,
    multiDownloadDurationMs: null,
    multiDownloadConcurrency: null,
    multiDownloadStatus: null,
    uploadSingleMbps: null,
    singleUploadBytes: null,
    singleUploadDurationMs: null,
    singleUploadStatus: null,
    uploadMultiMbps: null,
    multiUploadBytes: null,
    multiUploadDurationMs: null,
    multiUploadConcurrency: null,
    multiUploadStatus: null,
    stability: null,
    testedAt: new Date().toISOString(),
  };
}

function applyDemoGate(result: RealSpeedTestRawResult): RealSpeedTestRawResult {
  const allowed = allowRealSpeedTestResult({
    executorKind: "real",
    runtimeKind: result.runtimeKind,
    exitVerified: result.exitVerified,
    identitiesAreFixture: result.provenance === "demo-fixture",
  });
  void allowed;
  result.isDemo = true;
  result.exitVerified = false;
  return result;
}

function fail(
  result: RealSpeedTestRawResult,
  code: EngineErrorCode,
  remaining: SpeedTestStageName[]
) {
  result.errorCode = code;
  result.errorMessage = engineErrorMessage(code);
  result.skippedStages = uniqueStages([...result.skippedStages, ...remaining]);
  return applyDemoGate(result);
}

function uniqueStages(stages: SpeedTestStageName[]) {
  return SPEED_TEST_STAGES.filter(
    (stage) => stage !== "COMPLETE" && stages.includes(stage)
  );
}

function classifyStart(error: unknown): EngineErrorCode {
  const code = classifyEngineError(error);
  if (
    code === "RUNTIME_BINARY_MISSING" ||
    code === "RUNTIME_START_FAILED" ||
    code === "NODE_UNSUPPORTED" ||
    code === "INVALID_NODE"
  ) {
    return code;
  }
  return "RUNTIME_START_FAILED";
}

function classifyHealth(error: unknown): EngineErrorCode {
  const code = classifyEngineError(error);
  if (code === "RUNTIME_HEALTH_FAILED") return code;
  return "RUNTIME_HEALTH_FAILED";
}

/**
 * C1 orchestration skeleton. Talks only to localhost FakeSpeedTestServer
 * through an injected ProxyRuntime. Never emits isDemo=false.
 */
export class RealSpeedTestExecutor implements RawMetricsExecutor {
  readonly kind = "real" as const;
  private readonly options: RealSpeedTestExecutorOptions;

  constructor(options: RealSpeedTestExecutorOptions) {
    if (options.validatedNode) {
      assertNoRawConfig(options.validatedNode);
    }
    this.options = options;
  }

  async run(job: ClaimedSpeedTestJob): Promise<RealSpeedTestRawResult> {
    const result = emptyResult();
    const planned = this.options.stages ?? ["LATENCY"];
    let runtime: ProxyRuntime | null = null;

    try {
      this.assertNotCancelled();
      this.validateJob(job);

      runtime = this.options.createRuntime(job);
      result.runtimeKind = runtime.kind;

      try {
        await runtime.start();
      } catch (error) {
        return fail(result, classifyStart(error), MEASUREMENT_STAGES);
      }

      try {
        const healthy = await healthCheckWithTimeout(
          runtime,
          this.options.healthCheckTimeoutMs
        );
        if (!healthy) {
          throw new SpeedTestEngineError("RUNTIME_HEALTH_FAILED");
        }
      } catch (error) {
        return fail(result, classifyHealth(error), MEASUREMENT_STAGES);
      }

      const endpoint = runtime.getProxyEndpoint();
      if (!endpoint) {
        return fail(result, "PROXY_CONNECT_FAILED", MEASUREMENT_STAGES);
      }

      result.currentStage = "LATENCY";
      const directWhoami = await localhostDirectGet(
        `${this.options.targetBaseUrl}/speedtest/whoami`,
        this.options.pingTimeoutMs ?? 2000
      );
      const proxiedWhoami = await localhostViaProxy({
        proxy: endpoint,
        targetUrl: `${this.options.targetBaseUrl}/speedtest/whoami`,
        timeoutMs: this.options.pingTimeoutMs ?? 2000,
      });

      const verification = verifyExitIdentity(
        parseWhoami(directWhoami),
        parseWhoami(proxiedWhoami),
        { runtimeKind: runtime.kind }
      );
      result.directIdentityHash = verification.directIdentityHash;
      result.proxiedIdentityHash = verification.proxiedIdentityHash;
      result.provenance = verification.provenance;
      result.exitVerified = false;

      if (!verification.orchestrationOk) {
        return fail(result, "EXIT_IP_UNVERIFIED", MEASUREMENT_STAGES);
      }

      const remainingAfterIdentity = MEASUREMENT_STAGES.filter((stage) => {
        if (stage === "PACKET_LOSS" && this.willRun(planned, "LATENCY")) return false;
        return !this.willRun(planned, stage);
      });
      result.skippedStages = remainingAfterIdentity;

      if (this.willRun(planned, "LATENCY")) {
        this.assertNotCancelled();
        result.currentStage = "LATENCY";
        await this.runLatency(result, endpoint);
        if (result.errorCode) {
          result.skippedStages = uniqueStages([
            ...result.skippedStages,
            ...MEASUREMENT_STAGES.filter((stage) => stage !== "LATENCY" && stage !== "PACKET_LOSS"),
          ]);
          return applyDemoGate(result);
        }
      }

      if (this.willRun(planned, "SINGLE_DOWNLOAD")) {
        this.assertNotCancelled();
        result.currentStage = "SINGLE_DOWNLOAD";
        await this.runSingleDownload(result, endpoint);
      }

      result.currentStage = "COMPLETE";
      result.skippedStages = uniqueStages(result.skippedStages);
      return applyDemoGate(result);
    } catch (error) {
      const code =
        error instanceof SpeedTestEngineError
          ? error.code
          : classifyEngineError(error);
      return fail(result, code === "UNKNOWN" ? "UNKNOWN" : code, MEASUREMENT_STAGES);
    } finally {
      if (runtime) {
        try {
          await runtime.stop();
          result.runtimeCleanedUp = true;
        } catch {
          result.runtimeCleanedUp = false;
        }
      }
      applyDemoGate(result);
    }
  }

  private willRun(planned: SpeedTestStageName[], stage: SpeedTestStageName) {
    return planned.includes(stage);
  }

  private validateJob(job: ClaimedSpeedTestJob) {
    if (!job.id) throw new SpeedTestEngineError("INVALID_NODE");
    if (!job.nodeId) throw new SpeedTestEngineError("INVALID_NODE");
    if (!job.serverId) throw new SpeedTestEngineError("SERVER_DISABLED");
  }

  private assertNotCancelled() {
    if (this.options.signal?.aborted) {
      throw new SpeedTestEngineError("TEST_CANCELLED");
    }
  }

  private async runLatency(
    result: RealSpeedTestRawResult,
    endpoint: NonNullable<ReturnType<ProxyRuntime["getProxyEndpoint"]>>
  ) {
    const attempts = this.options.pingAttempts ?? 10;
    const timeoutMs = this.options.pingTimeoutMs ?? 2000;
    const samples: number[] = [];
    let timedOut = 0;
    for (let i = 0; i < attempts; i += 1) {
      this.assertNotCancelled();
      const ping = await localhostViaProxy({
        proxy: endpoint,
        targetUrl: `${this.options.targetBaseUrl}/speedtest/ping`,
        timeoutMs,
        timeoutCode: "TARGET_TIMEOUT",
      });
      if (ping.ok) samples.push(ping.durationMs);
      if (ping.timedOut) timedOut += 1;
    }
    const stats = summarizeLatency(samples);
    result.latencyAttempts = attempts;
    result.latencySuccessCount = stats.sampleCount;
    result.latencyMinMs = stats.min;
    result.latencyMaxMs = stats.max;
    result.latencyAvgMs = stats.average;
    result.latencyP50Ms = stats.p50;
    result.latencyP90Ms = stats.p90;
    result.latencyMs = stats.p50;
    result.packetLossTotal = attempts;
    result.packetLossSuccess = stats.sampleCount;
    result.packetLossPercent = packetLossPercent(attempts, stats.sampleCount);
    result.successRateTotal = attempts;
    result.successRateSuccess = stats.sampleCount;
    result.successRatePercent = successRatePercent(stats.sampleCount, attempts);

    if (stats.sampleCount === 0 && timedOut > 0) {
      result.errorCode = "TARGET_TIMEOUT";
      result.errorMessage = engineErrorMessage("TARGET_TIMEOUT");
    }
  }

  private async runSingleDownload(
    result: RealSpeedTestRawResult,
    endpoint: NonNullable<ReturnType<ProxyRuntime["getProxyEndpoint"]>>
  ) {
    const timeoutMs = this.options.downloadTimeoutMs ?? 2000;
    const download = await localhostViaProxy({
      proxy: endpoint,
      targetUrl: `${this.options.targetBaseUrl}/speedtest/download?size=4096`,
      timeoutMs,
      timeoutCode: "DOWNLOAD_TIMEOUT",
    });
    if (download.timedOut || download.errorCode === "DOWNLOAD_TIMEOUT") {
      result.singleDownloadStatus = "TIMEOUT";
      result.errorCode = "DOWNLOAD_TIMEOUT";
      result.errorMessage = engineErrorMessage("DOWNLOAD_TIMEOUT");
      return;
    }
    if (!download.ok) {
      result.singleDownloadStatus = "FAILED";
      result.errorCode = download.errorCode ?? "TARGET_HTTP_ERROR";
      result.errorMessage = engineErrorMessage(result.errorCode);
      return;
    }
    const mbps = throughputMbps(download.bytes, download.durationMs);
    result.singleDownloadBytes = download.bytes;
    result.singleDownloadDurationMs = download.durationMs;
    result.downloadSingleMbps = mbps.ok ? mbps.mbps : null;
    result.singleDownloadStatus = "SUCCESS";
  }
}

function parseWhoami(response: { ok: boolean; body: Buffer }) {
  if (!response.ok) return null;
  try {
    return parseObservedIdentity(JSON.parse(response.body.toString("utf8")));
  } catch {
    return null;
  }
}
