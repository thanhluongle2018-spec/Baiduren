import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { inspect } from "node:util";
import { FakeProxyRuntime } from "../lib/proxy-runtime/fake-runtime";
import type { ProxyRuntime } from "../lib/proxy-runtime/types";
import { SpeedTestEngineError } from "../lib/speedtest/engine-error";
import {
  REAL_PRODUCTION_GATE_OPEN,
  createRealSpeedTestExecutor,
  createSpeedTestExecutor,
  mapRealSpeedTestResultToPersistence,
  summarizeValidatedNodeConfig,
  toRuntimeNodeInput,
  validateNodeForRealExecutor,
} from "../lib/speedtest";
import { RealSpeedTestExecutor } from "../lib/speedtest/real-executor";
import type { ClaimedSpeedTestJob, RealSpeedTestRawResult } from "../lib/speedtest/types";
import { parseSubscriptionContent } from "../lib/subscription/parse";
import { containsSecret } from "../lib/subscription/secrets";
import {
  FakeSpeedTestServer,
  type FakeSpeedTestServerOptions,
} from "./helpers/fake-speed-test-server";

const SS_PASSWORD = "fake-ss-password-9f3c";
const VMESS_UUID = "11111111-aaaa-bbbb-cccc-111111111111";
const TROJAN_PASSWORD = "fake-trojan-token-4k2m";
const VLESS_UUID = "22222222-aaaa-bbbb-cccc-222222222222";
const REALITY_PUBLIC_KEY = "fake-reality-public-key-aabb";
const REALITY_SHORT_ID = "abcd1234";
const GRPC_SERVICE = "GunService";
const SUBSCRIPTION_BLOB = `ss://YWVzLTI1Ni1nY206${SS_PASSWORD}@hk.example.invalid:8388`;

const job: ClaimedSpeedTestJob = {
  id: "job_c2_fixture",
  airportId: "ap_c2",
  nodeId: "node_c2",
  serverId: "srv_c2",
  region: "香港",
  concurrency: 1,
  isDemo: true,
  airportName: "C2 测试机场",
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

function clashNodes() {
  return parseSubscriptionContent(`proxies:
  - name: 香港 01
    type: ss
    server: hk.example.invalid
    port: 8388
    cipher: aes-256-gcm
    password: ${SS_PASSWORD}
    plugin: obfs
    plugin-opts:
      mode: http
  - name: 美国 01
    type: vmess
    server: us.example.invalid
    port: 443
    uuid: ${VMESS_UUID}
    alterId: 0
    cipher: auto
    network: ws
    tls: true
    servername: us.example.invalid
    ws-opts:
      path: /vmess
      headers:
        Host: us.example.invalid
  - name: 日本中转
    type: trojan
    server: jp.example.invalid
    port: 443
    password: ${TROJAN_PASSWORD}
    sni: jp.example.invalid
    client-fingerprint: chrome
    network: tcp
  - name: 新加坡 Reality
    type: vless
    server: sg.example.invalid
    port: 443
    uuid: ${VLESS_UUID}
    network: grpc
    tls: true
    flow: xtls-rprx-vision
    encryption: none
    servername: sg.example.invalid
    client-fingerprint: chrome
    reality-opts:
      public-key: ${REALITY_PUBLIC_KEY}
      short-id: ${REALITY_SHORT_ID}
    grpc-opts:
      grpc-service-name: ${GRPC_SERVICE}
    h2-opts:
      path: /h2
      host:
        - sg.example.invalid
  - name: SOCKS 香港
    type: socks5
    server: socks.example.invalid
    port: 1080
    username: fake-user
    password: fake-socks-pass
  - name: HTTP 台湾
    type: https
    server: http.example.invalid
    port: 443
    username: fake-http-user
    password: fake-http-pass
    sni: http.example.invalid
`);
}

function emptyRaw(overrides: Partial<RealSpeedTestRawResult> = {}): RealSpeedTestRawResult {
  return {
    kind: "real-executor",
    isDemo: true,
    provenance: "demo-fixture",
    exitVerified: false,
    runtimeKind: "fake",
    runtimeCleanedUp: true,
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
    testedAt: "2026-09-17T08:00:00.000Z",
    ...overrides,
  };
}

function assertNoSecrets(blob: string) {
  assert.equal(containsSecret(blob, [SS_PASSWORD, VMESS_UUID, TROJAN_PASSWORD, VLESS_UUID]), false);
  assert.equal(blob.includes(REALITY_PUBLIC_KEY), false);
  assert.equal(blob.includes("fake-socks-pass"), false);
  assert.equal(blob.includes("fake-http-pass"), false);
  assert.equal(blob.includes(SUBSCRIPTION_BLOB), false);
}

test("ValidatedNodeConfig 正常转换并保留 Clash transport 参数", () => {
  const parsed = clashNodes();
  const byProtocol = Object.fromEntries(parsed.nodes.map((node) => [node.protocol, node]));

  const ss = validateNodeForRealExecutor(byProtocol.ss);
  assert.equal(ss.protocol, "ss");
  assert.equal(ss.server, "hk.example.invalid");
  assert.equal(ss.port, 8388);
  assert.equal(ss.protocol === "ss" && ss.cipher, "aes-256-gcm");
  assert.equal(ss.protocol === "ss" && ss.plugin, "obfs");
  assert.equal("rawConfig" in ss, false);

  const vmess = validateNodeForRealExecutor(byProtocol.vmess);
  assert.equal(vmess.protocol, "vmess");
  assert.equal(vmess.tls, true);
  assert.equal(vmess.transport, "ws");
  assert.equal(vmess.protocol === "vmess" && vmess.ws?.path, "/vmess");
  assert.equal(vmess.protocol === "vmess" && vmess.alterId, 0);

  const trojan = validateNodeForRealExecutor(byProtocol.trojan);
  assert.equal(trojan.protocol, "trojan");
  assert.equal(trojan.tls, true);
  assert.equal(trojan.protocol === "trojan" && trojan.serverName, "jp.example.invalid");
  assert.equal(trojan.protocol === "trojan" && trojan.fingerprint, "chrome");

  const vless = validateNodeForRealExecutor(byProtocol.vless);
  assert.equal(vless.protocol, "vless");
  assert.equal(vless.transport, "grpc");
  assert.equal(vless.protocol === "vless" && vless.flow, "xtls-rprx-vision");
  assert.equal(vless.protocol === "vless" && vless.encryption, "none");
  assert.equal(vless.protocol === "vless" && vless.reality?.publicKey, REALITY_PUBLIC_KEY);
  assert.equal(vless.protocol === "vless" && vless.reality?.shortId, REALITY_SHORT_ID);
  assert.equal(vless.protocol === "vless" && vless.grpc?.serviceName, GRPC_SERVICE);
  assert.equal(vless.protocol === "vless" && vless.h2?.path, "/h2");

  const socks = validateNodeForRealExecutor(byProtocol.socks5);
  assert.equal(socks.protocol, "socks5");
  assert.equal(socks.protocol === "socks5" && socks.username, "fake-user");

  const http = validateNodeForRealExecutor(byProtocol.http);
  assert.equal(http.protocol, "http");
  assert.equal(http.tls, true);
  assert.equal(http.protocol === "http" && http.serverName, "http.example.invalid");
});

test("unsupported protocol 被拒绝", () => {
  assert.throws(
    () =>
      validateNodeForRealExecutor({
        name: "实验",
        protocol: "hysteria2",
        server: "hy.example.invalid",
        port: 443,
        rawConfig: {
          type: "hysteria2",
          password: TROJAN_PASSWORD,
          server: "hy.example.invalid",
          port: 443,
        },
      }),
    (error: unknown) =>
      error instanceof SpeedTestEngineError &&
      error.code === "NODE_UNSUPPORTED" &&
      !error.message.includes(TROJAN_PASSWORD)
  );
});

test("invalid port 被拒绝", () => {
  assert.throws(
    () =>
      validateNodeForRealExecutor({
        name: "香港 01",
        protocol: "ss",
        server: "hk.example.invalid",
        port: 70000,
        rawConfig: {
          type: "ss",
          cipher: "aes-256-gcm",
          password: SS_PASSWORD,
          server: "hk.example.invalid",
          port: 70000,
        },
      }),
    (error: unknown) =>
      error instanceof SpeedTestEngineError && error.code === "INVALID_NODE"
  );
  assert.throws(
    () =>
      validateNodeForRealExecutor({
        name: "香港 01",
        protocol: "ss",
        server: "hk.example.invalid",
        port: 0,
        rawConfig: {
          type: "ss",
          cipher: "aes-256-gcm",
          password: SS_PASSWORD,
          server: "hk.example.invalid",
          port: 0,
        },
      }),
    (error: unknown) =>
      error instanceof SpeedTestEngineError && error.code === "INVALID_NODE"
  );
});

test("localhost/private node target 被拒绝", () => {
  const hosts = [
    "localhost",
    "127.0.0.1",
    "10.0.0.8",
    "192.168.1.1",
    "172.16.0.2",
    "169.254.10.1",
    "::1",
    "fe80::1",
    "file:///etc/passwd",
  ];
  for (const server of hosts) {
    assert.throws(
      () =>
        validateNodeForRealExecutor({
          name: "内网节点",
          protocol: "ss",
          server,
          port: 8388,
          rawConfig: {
            type: "ss",
            cipher: "aes-256-gcm",
            password: SS_PASSWORD,
            server,
            port: 8388,
          },
        }),
      (error: unknown) =>
        error instanceof SpeedTestEngineError &&
        error.code === "INVALID_NODE" &&
        !error.message.includes(SS_PASSWORD),
      server
    );
  }
});

test("secrets 不进入日志或 debug summary", () => {
  const parsed = clashNodes();
  const vless = validateNodeForRealExecutor(parsed.nodes.find((node) => node.protocol === "vless")!);
  const summary = summarizeValidatedNodeConfig(vless);
  assert.deepEqual(Object.keys(summary).sort(), [
    "port",
    "protocol",
    "serverPresent",
    "tls",
    "transport",
  ]);
  assert.equal(summary.serverPresent, true);
  assert.equal("server" in summary, false);
  assert.equal("uuid" in summary, false);
  assert.equal("password" in summary, false);
  assert.equal("rawConfig" in summary, false);

  const logged: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    logged.push(args.map((arg) => (typeof arg === "string" ? arg : inspect(arg))).join(" "));
  };
  try {
    console.log(summary);
    console.log(JSON.stringify(vless));
    console.log(inspect(vless));
  } finally {
    console.log = original;
  }
  assertNoSecrets(JSON.stringify(summary));
  assertNoSecrets(JSON.stringify(vless));
  assertNoSecrets(logged.join("\n"));
});

test("rawConfig 不进入 executor contract", async () => {
  const parsed = clashNodes();
  const source = parsed.nodes.find((node) => node.protocol === "ss")!;
  const extraRaw = {
    ...source.rawConfig,
    subscription: SUBSCRIPTION_BLOB,
    extraSecret: SS_PASSWORD,
  };
  const validated = validateNodeForRealExecutor({
    ...source,
    rawConfig: extraRaw,
  });
  assert.equal("rawConfig" in validated, false);
  assert.equal("subscription" in validated, false);

  const runtimeInput = toRuntimeNodeInput(validated);
  assert.equal("subscription" in (runtimeInput.rawConfig as Record<string, unknown>), false);
  assert.equal("extraSecret" in (runtimeInput.rawConfig as Record<string, unknown>), false);

  const { address } = await startServer();
  const runtime = trackRuntime(new FakeProxyRuntime());
  const executor = new RealSpeedTestExecutor({
    createRuntime: () => runtime,
    targetBaseUrl: address,
    validatedNode: validated,
  });
  const result = await executor.run(job);
  assert.equal(result.isDemo, true);
  assert.equal("rawConfig" in result, false);
  const blob = JSON.stringify(result);
  assert.equal(blob.includes("rawConfig"), false);
  assert.equal(blob.includes(SUBSCRIPTION_BLOB), false);
  assert.equal(createSpeedTestExecutor().kind, "mock");
});

test("latency 正确映射，latencyMs = p50", async () => {
  const { address } = await startServer();
  const runtime = trackRuntime(new FakeProxyRuntime());
  const executor = createRealSpeedTestExecutor({
    createRuntime: () => runtime,
    targetBaseUrl: address,
    stages: ["LATENCY"],
  });
  const raw = await executor.run(job);
  const mapped = mapRealSpeedTestResultToPersistence(raw);
  assert.ok(raw.latencyP50Ms != null);
  assert.equal(mapped.result.latencyP50Ms, raw.latencyP50Ms);
  assert.equal(mapped.result.latencyMs, raw.latencyP50Ms);
  assert.equal(mapped.result.latencyAvgMs, raw.latencyAvgMs);
  assert.equal(mapped.result.latencyP90Ms, raw.latencyP90Ms);
  assert.equal(mapped.result.minLatencyMs, raw.latencyMinMs);
  assert.equal(mapped.result.maxLatencyMs, raw.latencyMaxMs);
  assert.equal(mapped.result.latencyAttempts, raw.latencyAttempts);
  assert.equal(mapped.result.latencySuccessCount, raw.latencySuccessCount);
  assert.equal(mapped.result.packetLossPercent, raw.packetLossPercent);
  assert.equal(mapped.result.packetLoss, raw.packetLossPercent);
  assert.equal(mapped.result.successRatePercent, raw.successRatePercent);
  assert.equal(mapped.result.successRate, raw.successRatePercent);
  assert.equal(mapped.result.isDemo, true);
});

test("download 正确映射", async () => {
  const { address } = await startServer();
  const runtime = trackRuntime(new FakeProxyRuntime());
  const executor = createRealSpeedTestExecutor({
    createRuntime: () => runtime,
    targetBaseUrl: address,
    stages: ["LATENCY", "SINGLE_DOWNLOAD"],
  });
  const raw = await executor.run(job);
  const mapped = mapRealSpeedTestResultToPersistence(raw);
  assert.equal(raw.singleDownloadStatus, "SUCCESS");
  assert.equal(mapped.result.singleDownloadStatus, "SUCCESS");
  assert.equal(mapped.result.downloadSingleMbps, raw.downloadSingleMbps);
  assert.equal(mapped.result.singleDownloadBytes, raw.singleDownloadBytes);
  assert.equal(mapped.result.singleDownloadDurationMs, raw.singleDownloadDurationMs);
  assert.equal(mapped.result.downloadMbps, raw.downloadSingleMbps);
  assert.equal(mapped.result.downloadMultiMbps, null);
  assert.equal(mapped.result.multiDownloadBytes, null);

  const multi = mapRealSpeedTestResultToPersistence(
    emptyRaw({
      currentStage: "COMPLETE",
      downloadMultiMbps: 210.5,
      multiDownloadBytes: 64 * 1024 * 1024,
      multiDownloadDurationMs: 900,
      multiDownloadConcurrency: 4,
      multiDownloadStatus: "SUCCESS",
      skippedStages: ["LATENCY", "PACKET_LOSS", "SINGLE_DOWNLOAD", "SINGLE_UPLOAD", "MULTI_UPLOAD"],
    })
  );
  assert.equal(multi.result.downloadMultiMbps, 210.5);
  assert.equal(multi.result.downloadMbps, 210.5);
  assert.equal(multi.result.multiDownloadConcurrency, 4);
  assert.equal(multi.result.multiDownloadStatus, "SUCCESS");
});

test("upload 正确映射", () => {
  const mapped = mapRealSpeedTestResultToPersistence(
    emptyRaw({
      currentStage: "COMPLETE",
      uploadSingleMbps: 18.5,
      singleUploadBytes: 16 * 1024 * 1024,
      singleUploadDurationMs: 800,
      singleUploadStatus: "SUCCESS",
      uploadMultiMbps: 42,
      multiUploadBytes: 32 * 1024 * 1024,
      multiUploadDurationMs: 700,
      multiUploadConcurrency: 4,
      multiUploadStatus: "PARTIAL",
      skippedStages: ["LATENCY", "PACKET_LOSS", "SINGLE_DOWNLOAD", "MULTI_DOWNLOAD"],
    })
  );
  assert.equal(mapped.result.uploadSingleMbps, 18.5);
  assert.equal(mapped.result.singleUploadBytes, 16 * 1024 * 1024);
  assert.equal(mapped.result.singleUploadDurationMs, 800);
  assert.equal(mapped.result.singleUploadStatus, "SUCCESS");
  assert.equal(mapped.result.uploadMultiMbps, 42);
  assert.equal(mapped.result.uploadMbps, 42);
  assert.equal(mapped.result.multiUploadConcurrency, 4);
  assert.equal(mapped.result.multiUploadStatus, "PARTIAL");
  assert.equal(mapped.result.singleThread, false);
});

test("partial stage 正确映射：失败 status + null metric，不是 0", () => {
  const mapped = mapRealSpeedTestResultToPersistence(
    emptyRaw({
      currentStage: "SINGLE_DOWNLOAD",
      latencyP50Ms: 28,
      latencyAvgMs: 30,
      latencyMinMs: 20,
      latencyMaxMs: 40,
      latencyP90Ms: 36,
      latencyAttempts: 10,
      latencySuccessCount: 9,
      packetLossPercent: 10,
      packetLossTotal: 10,
      packetLossSuccess: 9,
      successRatePercent: 90,
      successRateTotal: 10,
      successRateSuccess: 9,
      downloadSingleMbps: 0,
      singleDownloadBytes: 0,
      singleDownloadDurationMs: 0,
      singleDownloadStatus: "TIMEOUT",
      errorCode: "DOWNLOAD_TIMEOUT",
      errorMessage: `download failed password=${SS_PASSWORD}`,
      skippedStages: ["MULTI_DOWNLOAD", "SINGLE_UPLOAD", "MULTI_UPLOAD"],
    })
  );
  assert.equal(mapped.result.latencyMs, 28);
  assert.equal(mapped.result.singleDownloadStatus, "TIMEOUT");
  assert.equal(mapped.result.downloadSingleMbps, null);
  assert.equal(mapped.result.singleDownloadBytes, null);
  assert.equal(mapped.result.singleDownloadDurationMs, null);
  assert.notEqual(mapped.result.downloadSingleMbps, 0);
  assert.equal(mapped.result.errorCode, "DOWNLOAD_TIMEOUT");
  assert.equal(mapped.result.errorMessage?.includes(SS_PASSWORD), false);
  assert.equal(mapped.job.currentStage, "SINGLE_DOWNLOAD");
});

test("skipped stage metrics 保持 null", async () => {
  const { address } = await startServer();
  const runtime = trackRuntime(new FakeProxyRuntime());
  const executor = createRealSpeedTestExecutor({
    createRuntime: () => runtime,
    targetBaseUrl: address,
    stages: ["LATENCY"],
  });
  const raw = await executor.run(job);
  const mapped = mapRealSpeedTestResultToPersistence(raw);
  assert.ok(mapped.result.latencyP50Ms != null);
  assert.equal(mapped.result.downloadSingleMbps, null);
  assert.equal(mapped.result.downloadMultiMbps, null);
  assert.equal(mapped.result.uploadSingleMbps, null);
  assert.equal(mapped.result.uploadMultiMbps, null);
  assert.equal(mapped.result.singleDownloadBytes, null);
  assert.equal(mapped.result.multiDownloadBytes, null);
  assert.equal(mapped.result.singleUploadBytes, null);
  assert.equal(mapped.result.multiUploadBytes, null);
  assert.equal(mapped.result.singleDownloadStatus, null);
  assert.equal(mapped.result.multiDownloadStatus, null);
  assert.equal(mapped.result.singleUploadStatus, null);
  assert.equal(mapped.result.multiUploadStatus, null);
  assert.equal(mapped.result.skippedStages?.includes("SINGLE_DOWNLOAD"), true);
  assert.equal(mapped.result.skippedStages?.includes("MULTI_UPLOAD"), true);
  assert.equal(mapped.job.currentStage, "COMPLETE");
});

test("errorCode 正确映射并 redaction", async () => {
  const { address } = await startServer({ identicalWhoami: true });
  const runtime = trackRuntime(new FakeProxyRuntime());
  const executor = createRealSpeedTestExecutor({
    createRuntime: () => runtime,
    targetBaseUrl: address,
    stages: ["LATENCY", "SINGLE_DOWNLOAD"],
  });
  const raw = await executor.run(job);
  const mapped = mapRealSpeedTestResultToPersistence(raw);
  assert.equal(raw.errorCode, "EXIT_IP_UNVERIFIED");
  assert.equal(mapped.result.errorCode, "EXIT_IP_UNVERIFIED");
  assert.equal(mapped.job.errorCode, "EXIT_IP_UNVERIFIED");
  assert.equal(mapped.result.errorMessage, "无法证明请求经过机场节点。");
  assert.equal(mapped.result.downloadSingleMbps, null);
});

test("exit hash 正确映射，明文 IP 不进入持久化", async () => {
  const { address } = await startServer();
  const runtime = trackRuntime(new FakeProxyRuntime());
  const executor = createRealSpeedTestExecutor({
    createRuntime: () => runtime,
    targetBaseUrl: address,
  });
  const raw = await executor.run(job);
  const mapped = mapRealSpeedTestResultToPersistence(raw);
  assert.equal(typeof mapped.result.directIdentityHash, "string");
  assert.equal(mapped.result.directIdentityHash?.length, 64);
  assert.equal(mapped.result.proxiedIdentityHash?.length, 64);
  assert.equal(mapped.result.exitVerified, false);
  const persistBlob = JSON.stringify(mapped);
  assert.equal(persistBlob.includes("198.51.100.20"), false);
  assert.equal(persistBlob.includes("203.0.113.10"), false);

  const dropped = mapRealSpeedTestResultToPersistence(
    emptyRaw({
      directIdentityHash: "203.0.113.10",
      proxiedIdentityHash: "198.51.100.20",
    })
  );
  assert.equal(dropped.result.directIdentityHash, null);
  assert.equal(dropped.result.proxiedIdentityHash, null);
});

test("stability 保持 null，不计算", () => {
  const mapped = mapRealSpeedTestResultToPersistence(
    emptyRaw({
      latencyP50Ms: 20,
      downloadSingleMbps: 80,
      singleDownloadStatus: "SUCCESS",
      currentStage: "COMPLETE",
    })
  );
  assert.equal(mapped.result.stability, null);
});

test("isDemo 强制保持 true，生产 gate 仍关闭", async () => {
  assert.equal(REAL_PRODUCTION_GATE_OPEN, false);
  assert.equal(createSpeedTestExecutor().kind, "mock");

  const { address } = await startServer();
  const runtime = trackRuntime(new FakeProxyRuntime());
  const executor = createRealSpeedTestExecutor({
    createRuntime: () => runtime,
    targetBaseUrl: address,
  });
  const raw = await executor.run(job);
  const tampered = {
    ...raw,
    isDemo: false,
    exitVerified: true,
  } as unknown as RealSpeedTestRawResult;
  const mapped = mapRealSpeedTestResultToPersistence(tampered);
  assert.equal(raw.isDemo, true);
  assert.equal(mapped.result.isDemo, true);
  assert.equal(mapped.result.exitVerified, false);
  assert.notEqual(mapped.result.isDemo, false);
});
