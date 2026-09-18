import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { FakeProxyRuntime } from "../lib/proxy-runtime/fake-runtime";
import type { ProxyRuntime } from "../lib/proxy-runtime/types";
import {
  REAL_PRODUCTION_GATE_OPEN,
  allowRealSpeedTestResult,
  createSpeedTestExecutor,
  verifyExitIdentity,
} from "../lib/speedtest";
import { RealSpeedTestExecutor } from "../lib/speedtest/real-executor";
import type { ClaimedSpeedTestJob } from "../lib/speedtest/types";
import {
  FakeSpeedTestServer,
  type FakeSpeedTestServerOptions,
} from "./helpers/fake-speed-test-server";

const job: ClaimedSpeedTestJob = {
  id: "job_c1_fixture",
  airportId: "ap_c1",
  nodeId: "node_c1",
  serverId: "srv_c1",
  region: "香港",
  concurrency: 1,
  isDemo: true,
  airportName: "C1 测试机场",
  nodeName: "香港 01",
  serverName: "fixture",
};

const runtimes: ProxyRuntime[] = [];
const servers: FakeSpeedTestServer[] = [];

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.stop()));
  await Promise.all(servers.splice(0).map((server) => server.stop()));
});

function trackRuntime<T extends ProxyRuntime>(runtime: T) {
  runtimes.push(runtime);
  return runtime;
}

function trackServer(server: FakeSpeedTestServer) {
  servers.push(server);
  return server;
}

async function startServer(options: FakeSpeedTestServerOptions = {}) {
  const server = trackServer(new FakeSpeedTestServer(options));
  const address = await server.start();
  return { server, address };
}

function spyStop(runtime: ProxyRuntime) {
  let calls = 0;
  const original = runtime.stop.bind(runtime);
  runtime.stop = async () => {
    calls += 1;
    await original();
  };
  return {
    runtime,
    stopCalls() {
      return calls;
    },
  };
}

test("production executor factory still returns mock", () => {
  const executor = createSpeedTestExecutor();
  assert.equal(executor.kind, "mock");
  assert.equal(REAL_PRODUCTION_GATE_OPEN, false);
  assert.equal(
    allowRealSpeedTestResult({
      executorKind: "real",
      runtimeKind: "mihomo",
      exitVerified: true,
      identitiesAreFixture: false,
    }),
    false
  );
});

test("RealSpeedTestExecutor 能创建并执行 Fake orchestration", async () => {
  const { address } = await startServer();
  const spy = spyStop(trackRuntime(new FakeProxyRuntime()));
  const executor = new RealSpeedTestExecutor({
    createRuntime: () => spy.runtime,
    targetBaseUrl: address,
  });
  const result = await executor.run(job);
  assert.equal(result.kind, "real-executor");
  assert.equal(result.isDemo, true);
  assert.equal(result.exitVerified, false);
  assert.equal(result.runtimeKind, "fake");
  assert.equal(result.runtimeCleanedUp, true);
  assert.equal(result.provenance, "demo-fixture");
  assert.equal(result.errorCode, null);
  assert.equal(result.currentStage, "COMPLETE");
  assert.ok((result.latencySuccessCount ?? 0) > 0);
  assert.ok(result.latencyP50Ms != null);
  assert.equal(result.downloadSingleMbps, null);
  assert.equal(result.singleDownloadBytes, null);
  assert.equal(result.uploadSingleMbps, null);
  assert.equal(result.stability, null);
  assert.equal(result.skippedStages.includes("SINGLE_DOWNLOAD"), true);
  assert.equal(result.skippedStages.includes("MULTI_DOWNLOAD"), true);
  assert.equal(result.skippedStages.includes("SINGLE_UPLOAD"), true);
  assert.equal(result.skippedStages.includes("MULTI_UPLOAD"), true);
  assert.equal(spy.stopCalls() >= 1, true);
});

test("runtime startup failure 返回 RUNTIME_START_FAILED", async () => {
  const { address } = await startServer();
  const spy = spyStop(trackRuntime(new FakeProxyRuntime({ failStart: true })));
  const executor = new RealSpeedTestExecutor({
    createRuntime: () => spy.runtime,
    targetBaseUrl: address,
  });
  const result = await executor.run(job);
  assert.equal(result.errorCode, "RUNTIME_START_FAILED");
  assert.equal(result.isDemo, true);
  assert.equal(result.exitVerified, false);
  assert.equal(result.downloadSingleMbps, null);
  assert.equal(result.skippedStages.includes("LATENCY"), true);
  assert.equal(result.skippedStages.includes("SINGLE_DOWNLOAD"), true);
  assert.equal(spy.stopCalls() >= 1, true);
  assert.equal(result.runtimeCleanedUp, true);
});

test("runtime health failure 返回 RUNTIME_HEALTH_FAILED", async () => {
  const { address } = await startServer();
  const runtime = trackRuntime(new FakeProxyRuntime());
  runtime.healthCheck = async () => false;
  const spy = spyStop(runtime);
  const executor = new RealSpeedTestExecutor({
    createRuntime: () => spy.runtime,
    targetBaseUrl: address,
  });
  const result = await executor.run(job);
  assert.equal(result.errorCode, "RUNTIME_HEALTH_FAILED");
  assert.equal(result.isDemo, true);
  assert.equal(result.singleDownloadBytes, null);
  assert.equal(result.skippedStages.includes("SINGLE_DOWNLOAD"), true);
  assert.equal(spy.stopCalls() >= 1, true);
});

test("health check timeout 也归类为 RUNTIME_HEALTH_FAILED", async () => {
  const { address } = await startServer();
  const runtime = trackRuntime(new FakeProxyRuntime({ healthCheckDelayMs: 400 }));
  const executor = new RealSpeedTestExecutor({
    createRuntime: () => runtime,
    targetBaseUrl: address,
    healthCheckTimeoutMs: 40,
  });
  const result = await executor.run(job);
  assert.equal(result.errorCode, "RUNTIME_HEALTH_FAILED");
  assert.equal(result.isDemo, true);
  assert.equal(result.runtimeCleanedUp, true);
});

test("direct/proxied identity 相同必须 EXIT_IP_UNVERIFIED", async () => {
  const { address } = await startServer({ identicalWhoami: true });
  const runtime = trackRuntime(new FakeProxyRuntime());
  const executor = new RealSpeedTestExecutor({
    createRuntime: () => runtime,
    targetBaseUrl: address,
    stages: ["LATENCY", "SINGLE_DOWNLOAD"],
  });
  const result = await executor.run(job);
  assert.equal(result.errorCode, "EXIT_IP_UNVERIFIED");
  assert.equal(result.isDemo, true);
  assert.equal(result.exitVerified, false);
  assert.equal(result.downloadSingleMbps, null);
  assert.equal(result.singleDownloadBytes, null);
  assert.equal(result.latencyP50Ms, null);
  assert.equal(result.skippedStages.includes("SINGLE_DOWNLOAD"), true);
  assert.equal(result.skippedStages.includes("LATENCY"), true);
});

test("exit verification 失败禁止进入 throughput，即使请求了 download", async () => {
  const { address } = await startServer({ identicalWhoami: true });
  const runtime = trackRuntime(new FakeProxyRuntime());
  const executor = new RealSpeedTestExecutor({
    createRuntime: () => runtime,
    targetBaseUrl: address,
    stages: ["LATENCY", "SINGLE_DOWNLOAD", "MULTI_DOWNLOAD"],
  });
  const result = await executor.run(job);
  assert.equal(result.errorCode, "EXIT_IP_UNVERIFIED");
  assert.notEqual(result.errorCode, null);
  assert.equal(result.singleDownloadStatus, null);
  assert.equal(result.downloadSingleMbps, null);
  assert.equal(result.downloadMultiMbps, null);
  assert.equal(result.singleDownloadBytes, null);
});

test("FakeRuntime 结果必须 isDemo=true", async () => {
  const { address } = await startServer();
  const runtime = trackRuntime(new FakeProxyRuntime());
  const executor = new RealSpeedTestExecutor({
    createRuntime: () => runtime,
    targetBaseUrl: address,
  });
  const result = await executor.run(job);
  assert.equal(result.isDemo, true);
  assert.equal(result.exitVerified, false);
  assert.equal(result.runtimeKind, "fake");
});

test("任何异常必须 cleanup runtime 并调用 stop()", async () => {
  const { address } = await startServer();
  const spy = spyStop(trackRuntime(new FakeProxyRuntime({ failStart: true })));
  const executor = new RealSpeedTestExecutor({
    createRuntime: () => spy.runtime,
    targetBaseUrl: address,
  });
  await executor.run(job);
  assert.equal(spy.stopCalls() >= 1, true);

  const healthy = spyStop(trackRuntime(new FakeProxyRuntime()));
  const okExecutor = new RealSpeedTestExecutor({
    createRuntime: () => healthy.runtime,
    targetBaseUrl: address,
  });
  await okExecutor.run(job);
  assert.equal(healthy.stopCalls() >= 1, true);
});

test("timeout 必须返回 TARGET_TIMEOUT", async () => {
  const { address } = await startServer({ pingDelayMs: 400 });
  const runtime = trackRuntime(new FakeProxyRuntime());
  const executor = new RealSpeedTestExecutor({
    createRuntime: () => runtime,
    targetBaseUrl: address,
    pingAttempts: 2,
    pingTimeoutMs: 50,
  });
  const result = await executor.run(job);
  assert.equal(result.errorCode, "TARGET_TIMEOUT");
  assert.equal(result.isDemo, true);
  assert.equal(result.downloadSingleMbps, null);
  assert.equal(result.singleDownloadBytes, null);
});

test("partial metrics：未执行 stage 必须是 null 并记录 skippedStages", async () => {
  const { address } = await startServer();
  const runtime = trackRuntime(new FakeProxyRuntime());
  const executor = new RealSpeedTestExecutor({
    createRuntime: () => runtime,
    targetBaseUrl: address,
    stages: ["LATENCY"],
  });
  const result = await executor.run(job);
  assert.equal(result.errorCode, null);
  assert.ok(result.latencyP50Ms != null);
  assert.equal(result.downloadSingleMbps, null);
  assert.equal(result.downloadMultiMbps, null);
  assert.equal(result.uploadSingleMbps, null);
  assert.equal(result.uploadMultiMbps, null);
  assert.equal(result.singleDownloadBytes, null);
  assert.equal(result.multiDownloadBytes, null);
  assert.equal(result.singleUploadBytes, null);
  assert.equal(result.multiUploadBytes, null);
  assert.equal(result.singleDownloadStatus, null);
  assert.equal(result.multiDownloadStatus, null);
  assert.equal(result.stability, null);
  assert.deepEqual(
    result.skippedStages,
    ["SINGLE_DOWNLOAD", "MULTI_DOWNLOAD", "SINGLE_UPLOAD", "MULTI_UPLOAD"]
  );
});

test("verifyExitIdentity：相同 IP 不能当真实出口", () => {
  const identity = {
    observedSourceIp: "203.0.113.10",
    path: "proxied-fixture",
    fixture: true,
    isDemo: true,
    via: "x",
  };
  const verification = verifyExitIdentity(identity, identity, { runtimeKind: "fake" });
  assert.equal(verification.orchestrationOk, false);
  assert.equal(verification.reason, "EXIT_IP_UNVERIFIED");
  assert.equal(verification.exitVerified, false);
});
