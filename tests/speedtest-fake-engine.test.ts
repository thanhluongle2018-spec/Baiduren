import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { FakeProxyRuntime } from "../lib/proxy-runtime/fake-runtime";
import { ProxyRuntimeError } from "../lib/proxy-runtime/errors";
import type { ProxyEndpoint, ProxyRuntime } from "../lib/proxy-runtime/types";
import { MULTI_THREAD_CONCURRENCY } from "../lib/speedtest/constants";
import {
  BYTE_CAPS,
  aggregateWallClockThroughput,
  applyByteCap,
  clampConcurrency,
  classifyEngineError,
  successRatePercent,
  summarizeLatency,
  throughputMbps,
  type EngineErrorCode,
} from "../lib/speedtest/metrics";
import {
  FAKE_DIRECT_IP,
  FAKE_PROXIED_IP,
  FAKE_SERVER_ID,
  FakeSpeedTestServer,
  type FakeWhoami,
} from "./helpers/fake-speed-test-server";
import {
  directGet,
  parseJsonBody,
  requestViaHttpProxy,
  type ViaProxyResult,
} from "./helpers/via-proxy-http";

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

async function startPair(serverOptions?: ConstructorParameters<typeof FakeSpeedTestServer>[0]) {
  const server = trackServer(new FakeSpeedTestServer(serverOptions));
  const runtime = trackRuntime(new FakeProxyRuntime());
  const address = await server.start();
  const endpoint = await runtime.start();
  return { server, runtime, address, endpoint };
}

function pingUrl(address: string, extra = "") {
  return `${address}/speedtest/ping${extra}`;
}

function downloadUrl(address: string, size: number, extra = "") {
  return `${address}/speedtest/download?size=${size}${extra}`;
}

function uploadUrl(address: string, extra = "") {
  return `${address}/speedtest/upload${extra}`;
}

async function viaGet(
  endpoint: ProxyEndpoint,
  targetUrl: string,
  options: { timeoutMs?: number; capBytes?: number; timeoutCode?: EngineErrorCode } = {}
) {
  return requestViaHttpProxy({
    proxy: endpoint,
    targetUrl,
    timeoutMs: options.timeoutMs ?? 5000,
    capBytes: options.capBytes,
    timeoutCode: options.timeoutCode,
  });
}

async function viaPost(
  endpoint: ProxyEndpoint,
  targetUrl: string,
  body: Buffer,
  options: { timeoutMs?: number; capBytes?: number; timeoutCode?: EngineErrorCode } = {}
) {
  return requestViaHttpProxy({
    proxy: endpoint,
    targetUrl,
    method: "POST",
    body,
    timeoutMs: options.timeoutMs ?? 8000,
    capBytes: options.capBytes,
    timeoutCode: options.timeoutCode,
  });
}

test("Fake Runtime 生命周期 CREATED → STARTING → RUNNING → STOPPED", async () => {
  const runtime = trackRuntime(new FakeProxyRuntime({ startupDelayMs: 60 }));
  assert.equal(runtime.state(), "CREATED");
  const started = runtime.start();
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(runtime.state(), "STARTING");
  await started;
  assert.equal(runtime.state(), "RUNNING");
  await runtime.stop();
  assert.equal(runtime.state(), "STOPPED");
});

test("Fake Runtime 启动失败路径不会伪装成真实测速", async () => {
  const runtime = trackRuntime(new FakeProxyRuntime({ failStart: true }));
  await assert.rejects(
    () => runtime.start(),
    (error: unknown) => error instanceof ProxyRuntimeError && error.code === "PROCESS_CRASH"
  );
  assert.equal(runtime.state(), "STOPPED");
  assert.equal(classifyEngineError(new ProxyRuntimeError("PROCESS_CRASH")), "RUNTIME_START_FAILED");
  assert.equal(runtime.kind, "fake");
});

test("whoami：direct 与 proxied fixture identity 不同，且不是真实出口 IP 验证", async () => {
  const { runtime, address, endpoint } = await startPair();
  const direct = parseJsonBody<FakeWhoami>((await directGet(`${address}/speedtest/whoami`)).body);
  const proxied = await viaGet(endpoint, `${address}/speedtest/whoami`);
  const viaBody = parseJsonBody<FakeWhoami>(proxied.body);

  assert.equal(direct.isDemo, true);
  assert.equal(viaBody.isDemo, true);
  assert.equal(proxied.isDemo, true);
  assert.equal(direct.path, "direct");
  assert.equal(direct.observedSourceIp, FAKE_DIRECT_IP);
  assert.equal(viaBody.path, "proxied-fixture");
  assert.equal(viaBody.observedSourceIp, FAKE_PROXIED_IP);
  assert.equal(viaBody.via, runtime.id);
  assert.equal(viaBody.serverId, FAKE_SERVER_ID);
  assert.notEqual(direct.observedSourceIp, viaBody.observedSourceIp);
  assert.equal(direct.fixture, true);
  assert.equal(viaBody.fixture, true);
  // 这是 fake fixture 行为，不代表真实代理出口 IP 已验证。
  assert.equal(
    viaBody.path === "proxied-fixture" && viaBody.isDemo && viaBody.fixture,
    true,
    "fake fixture identity only; real proxy exit IP is not verified"
  );
});

test("latency：经 Fake Proxy 请求 FakeSpeedTestServer 10 次 ping 并计算统计量", async () => {
  const { address, endpoint } = await startPair();
  const results: ViaProxyResult[] = [];
  for (let i = 0; i < 10; i += 1) {
    results.push(await viaGet(endpoint, pingUrl(address)));
  }
  const success = results.filter((item) => item.ok);
  assert.equal(success.length, 10);
  assert.equal(results.every((item) => item.isDemo), true);
  const stats = summarizeLatency(success.map((item) => item.durationMs));
  assert.equal(stats.sampleCount, 10);
  assert.ok(stats.min != null && stats.max != null && stats.average != null);
  assert.ok(stats.min <= stats.average);
  assert.ok(stats.average <= stats.max);
  assert.ok(stats.p50 != null && stats.p90 != null);
  assert.ok(stats.p50 <= stats.p90);
  assert.equal(successRatePercent(success.length, results.length), 100);
  assert.equal(Number.isFinite(stats.p90), true);
});

test("single-thread download：bytes / duration / Mbps / 32 MiB cap", { timeout: 40_000 }, async () => {
  const { address, endpoint } = await startPair();
  const size = 256 * 1024;
  const measured = await viaGet(endpoint, downloadUrl(address, size), { timeoutMs: 10_000 });
  assert.equal(measured.ok, true);
  assert.equal(measured.isDemo, true);
  assert.equal(measured.bytes, size);
  const mbps = throughputMbps(measured.bytes, measured.durationMs);
  assert.equal(mbps.ok, true);

  const over = BYTE_CAPS.downloadSingle + 64 * 1024;
  const capped = await viaGet(endpoint, downloadUrl(address, over), {
    capBytes: BYTE_CAPS.downloadSingle,
    timeoutMs: 30_000,
  });
  const cap = applyByteCap(over, BYTE_CAPS.downloadSingle);
  assert.equal(capped.bytes, cap.accepted);
  assert.equal(capped.bytes, BYTE_CAPS.downloadSingle);
  assert.equal(capped.truncated, true);
  assert.equal(capped.errorCode, "BYTE_CAP_REACHED");
  assert.equal(capped.ok, true);
  assert.equal(throughputMbps(capped.bytes, capped.durationMs).ok, true);
});

test("multi-thread download：concurrency=4，每连接 16 MiB，总计 64 MiB，wall-clock 聚合", { timeout: 60_000 }, async () => {
  const { address, endpoint } = await startPair();
  const concurrency = clampConcurrency(MULTI_THREAD_CONCURRENCY);
  assert.equal(concurrency, 4);
  const perConnection = BYTE_CAPS.downloadMultiPerConnection;
  const wallStart = Date.now();
  const results = await Promise.all(
    Array.from({ length: concurrency }, () =>
      viaGet(endpoint, downloadUrl(address, perConnection + 1024), {
        capBytes: perConnection,
        timeoutMs: 30_000,
      })
    )
  );
  const wallClockMs = Math.max(1, Date.now() - wallStart);
  const aggregate = aggregateWallClockThroughput(results, wallClockMs);
  assert.equal(results.length, 4);
  assert.equal(results.every((item) => item.isDemo), true);
  assert.equal(aggregate.successfulBytes, BYTE_CAPS.downloadMultiTotal);
  assert.equal(applyByteCap(aggregate.successfulBytes, BYTE_CAPS.downloadMultiTotal).reached, true);
  assert.equal(aggregate.completeSuccess, true);
  assert.equal(aggregate.throughput.ok, true);
  const wallClockThroughput = throughputMbps(aggregate.successfulBytes, wallClockMs);
  assert.deepEqual(aggregate.throughput, wallClockThroughput);
  assert.equal(wallClockThroughput.ok, true);
  if (wallClockThroughput.ok) {
    assert.equal(Number.isFinite(wallClockThroughput.mbps), true);
  }
});

test("single-thread upload：body bytes / duration / Mbps / 16 MiB cap", { timeout: 40_000 }, async () => {
  const { server, address, endpoint } = await startPair();
  const size = 128 * 1024;
  const measured = await viaPost(endpoint, uploadUrl(address), Buffer.alloc(size));
  assert.equal(measured.ok, true);
  assert.equal(measured.isDemo, true);
  const ack = parseJsonBody<{ isDemo: true; bytes: number }>(measured.body);
  assert.equal(ack.bytes, size);
  assert.equal(throughputMbps(size, measured.durationMs).ok, true);

  const capSize = BYTE_CAPS.uploadSingle;
  const capped = await viaPost(endpoint, uploadUrl(address), Buffer.alloc(capSize), {
    timeoutMs: 30_000,
  });
  assert.equal(capped.ok, true);
  assert.equal(parseJsonBody<{ bytes: number }>(capped.body).bytes, capSize);
  assert.equal(applyByteCap(capSize, BYTE_CAPS.uploadSingle).reached, true);
  assert.equal(applyByteCap(capSize + 1, BYTE_CAPS.uploadSingle).truncated, true);
  assert.ok(server.bytesDiscarded() >= size + capSize);
});

test("multi-thread upload：concurrency=4，每连接 8 MiB，总计 32 MiB，wall-clock 聚合", { timeout: 60_000 }, async () => {
  const { address, endpoint } = await startPair();
  const concurrency = clampConcurrency(MULTI_THREAD_CONCURRENCY);
  assert.equal(concurrency, 4);
  const perConnection = BYTE_CAPS.uploadMultiPerConnection;
  const wallStart = Date.now();
  const results = await Promise.all(
    Array.from({ length: concurrency }, () =>
      viaPost(endpoint, uploadUrl(address), Buffer.alloc(perConnection), { timeoutMs: 30_000 })
    )
  );
  const wallClockMs = Math.max(1, Date.now() - wallStart);
  const aggregate = aggregateWallClockThroughput(
    results.map((item) => ({
      ok: item.ok,
      bytes: item.ok ? parseJsonBody<{ bytes: number }>(item.body).bytes : 0,
    })),
    wallClockMs
  );
  assert.equal(results.every((item) => item.isDemo), true);
  assert.equal(aggregate.successfulBytes, BYTE_CAPS.uploadMultiTotal);
  assert.equal(applyByteCap(aggregate.successfulBytes, BYTE_CAPS.uploadMultiTotal).reached, true);
  assert.equal(aggregate.completeSuccess, true);
  assert.equal(aggregate.throughput.ok, true);
  const wallClockThroughput = throughputMbps(aggregate.successfulBytes, wallClockMs);
  assert.deepEqual(aggregate.throughput, wallClockThroughput);
});

test("timeout：ping / download / upload 被正确分类", async () => {
  const { address, endpoint } = await startPair({
    pingDelayMs: 400,
    downloadDelayMs: 400,
    uploadDelayMs: 400,
  });

  const ping = await viaGet(endpoint, pingUrl(address), {
    timeoutMs: 50,
    timeoutCode: "TARGET_TIMEOUT",
  });
  assert.equal(ping.ok, false);
  assert.equal(ping.timedOut, true);
  assert.equal(classifyEngineError(ping.errorCode), "TARGET_TIMEOUT");
  assert.equal(ping.isDemo, true);

  const download = await viaGet(endpoint, downloadUrl(address, 1024), {
    timeoutMs: 50,
    timeoutCode: "DOWNLOAD_TIMEOUT",
  });
  assert.equal(download.ok, false);
  assert.equal(download.timedOut, true);
  assert.equal(classifyEngineError(download.errorCode), "DOWNLOAD_TIMEOUT");

  const upload = await viaPost(endpoint, uploadUrl(address), Buffer.alloc(32), {
    timeoutMs: 50,
    timeoutCode: "UPLOAD_TIMEOUT",
  });
  assert.equal(upload.ok, false);
  assert.equal(upload.timedOut, true);
  assert.equal(classifyEngineError(upload.errorCode), "UPLOAD_TIMEOUT");
});

test("partial failure：4 路下载 1 路失败，不把失败 bytes 算进成功，也不当成完整 SUCCESS", async () => {
  const { address, endpoint } = await startPair();
  const size = 64 * 1024;
  const wallStart = Date.now();
  const results = await Promise.all([
    viaGet(endpoint, downloadUrl(address, size, "&fail=1")),
    viaGet(endpoint, downloadUrl(address, size)),
    viaGet(endpoint, downloadUrl(address, size)),
    viaGet(endpoint, downloadUrl(address, size)),
  ]);
  const wallClockMs = Math.max(1, Date.now() - wallStart);
  const failed = results.filter((item) => !item.ok);
  const succeeded = results.filter((item) => item.ok);
  assert.equal(failed.length, 1);
  assert.equal(succeeded.length, 3);
  assert.equal(classifyEngineError(failed[0]?.errorCode), "TARGET_HTTP_ERROR");
  assert.ok((failed[0]?.bytes ?? 0) < size);
  const aggregate = aggregateWallClockThroughput(results, wallClockMs);
  assert.equal(aggregate.successfulBytes, size * 3);
  assert.equal(aggregate.failedCount, 1);
  assert.equal(aggregate.completeSuccess, false);
  assert.equal(aggregate.throughput.ok, true);
  assert.equal(results.every((item) => item.isDemo), true);
  const pingOnly = successRatePercent(10, 10);
  assert.equal(pingOnly, 100);
});
