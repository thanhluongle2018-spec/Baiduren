import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { GET as getSpeedTests } from "../app/api/speed-tests/route";
import { GET as getAirport } from "../app/api/airports/[slug]/route";
import { Prisma } from "../lib/generated/prisma/client";
import { mapResultMetrics, mapSpeedTest } from "../lib/data/mappers";
import { getPrisma, pingDatabase } from "../lib/prisma";
import { BYTE_CAPS } from "../lib/speedtest/metrics";
import {
  PUBLIC_SPEEDTEST_HIDDEN_KEYS,
  hashSpeedTestIdentity,
  sanitizeSkippedStages,
} from "../lib/speedtest/raw-metrics";
import { containsSecret } from "../lib/subscription/secrets";

const prisma = getPrisma();
const suffix = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
const airportId = `test3b3b_ap_${suffix}`;
const nodeId = `test3b3b_node_${suffix}`;
const serverId = `test3b3b_srv_${suffix}`;
const slug = `test-3b3b-${suffix}`;
const SECRET = "fake-ss-password-9f3c";
const UUID = "11111111-aaaa-bbbb-cccc-111111111111";
const TOKEN = "fake-trojan-token-4k2m";
const DIRECT_HASH = hashSpeedTestIdentity("fixture:direct-identity");
const PROXIED_HASH = hashSpeedTestIdentity("fixture:proxied-identity");

async function cleanup() {
  await prisma.speedTest.deleteMany({ where: { airportId } });
  await prisma.node.deleteMany({ where: { id: nodeId } });
  await prisma.airport.deleteMany({ where: { id: airportId } });
  await prisma.speedTestServer.deleteMany({ where: { id: serverId } });
}

before(async () => {
  const database = await pingDatabase();
  if (database !== "connected") {
    throw new Error("PostgreSQL is required for raw metrics schema tests");
  }
  await cleanup();
  await prisma.airport.create({
    data: {
      id: airportId,
      name: "3B-3B 测试机场",
      slug,
      summary: "raw metrics schema",
      status: "ACTIVE",
      isDemo: true,
    },
  });
  await prisma.node.create({
    data: {
      id: nodeId,
      airportId,
      name: "香港 01",
      region: "香港",
      kind: "中转",
      status: "ACTIVE",
      isDemo: true,
      protocol: "ss",
      server: "hk.example.invalid",
      port: 8388,
      fingerprint: `fp_${suffix}`,
      rawConfig: JSON.stringify({
        type: "ss",
        password: SECRET,
        uuid: UUID,
        token: TOKEN,
        server: "hk.example.invalid",
        port: 8388,
      }),
    },
  });
  await prisma.speedTestServer.create({
    data: {
      id: serverId,
      name: "schema-test-server",
      region: "香港",
      countryCode: "HK",
      city: "香港",
      bandwidthMbps: 1000,
      maxConcurrentTests: 2,
      status: "ACTIVE",
      isDemo: true,
    },
  });
});

after(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test("Prisma schema generates SpeedTest raw metric fields", () => {
  const speedTestFields = new Set<string>(Object.values(Prisma.SpeedTestScalarFieldEnum));
  const resultFields = new Set<string>(Object.values(Prisma.SpeedTestResultScalarFieldEnum));
  for (const field of [
    "testVersion",
    "latencyAttempts",
    "pingTimeoutMs",
    "downloadConcurrency",
    "uploadConcurrency",
    "singleDownloadCapBytes",
    "multiDownloadCapBytes",
    "singleUploadCapBytes",
    "multiUploadCapBytes",
    "totalTrafficCapBytes",
    "currentStage",
    "errorCode",
    "serverMaxConcurrencySnapshot",
    "serverBandwidthMbpsSnapshot",
    "nodeConcurrencySnapshot",
    "airportConcurrencySnapshot",
  ]) {
    assert.equal(speedTestFields.has(field), true, `SpeedTest.${field}`);
  }
  for (const field of [
    "latencyP50Ms",
    "latencyP90Ms",
    "latencyAvgMs",
    "packetLossTotal",
    "successRateTotal",
    "singleDownloadBytes",
    "multiDownloadBytes",
    "singleUploadBytes",
    "multiUploadBytes",
    "singleDownloadStatus",
    "multiDownloadStatus",
    "skippedStages",
    "exitVerified",
    "directIdentityHash",
    "proxiedIdentityHash",
    "latencyMs",
    "downloadMbps",
    "uploadMbps",
    "packetLoss",
    "successRate",
    "stability",
    "testedAt",
    "singleThread",
  ]) {
    assert.equal(resultFields.has(field), true, `SpeedTestResult.${field}`);
  }
});

test("nullable mapper fields stay null instead of 0", () => {
  const mapped = mapResultMetrics({
    latencyMs: 40,
    downloadMbps: 80,
    uploadMbps: 20,
    packetLoss: 1,
    successRate: 99,
    stability: 90,
    testedAt: new Date("2026-09-17T00:00:00.000Z"),
    isDemo: true,
    latencyP50Ms: null,
    latencyP90Ms: null,
    singleDownloadBytes: null,
    downloadMultiMbps: null,
    exitVerified: null,
  });
  assert.equal(mapped.latencyP50Ms, null);
  assert.equal(mapped.latencyP90Ms, null);
  assert.equal(mapped.singleDownloadBytes, null);
  assert.equal(mapped.packetLossTotal, null);
  assert.equal(mapped.successRateTotal, null);
  assert.equal(mapped.exitVerified, null);
  assert.equal(mapped.skippedStages, null);
  assert.notEqual(mapped.latencyP50Ms, 0);
  assert.notEqual(mapped.singleDownloadBytes, 0);
  assert.equal(mapped.isDemo, true);
});

test("sanitizeSkippedStages drops unknown values and secrets", () => {
  assert.deepEqual(
    sanitizeSkippedStages(["MULTI_UPLOAD", SECRET, "password", "SINGLE_DOWNLOAD"]),
    ["MULTI_UPLOAD", "SINGLE_DOWNLOAD"]
  );
  assert.equal(sanitizeSkippedStages(null), null);
});

test("SpeedTestResult can persist complete 3B-3 raw metrics", async () => {
  const job = await prisma.speedTest.create({
    data: {
      airportId,
      nodeId,
      serverId,
      status: "SUCCESS",
      mode: "MULTI_THREAD",
      concurrency: 4,
      region: "香港",
      isDemo: true,
      testVersion: "3b3-v1",
      currentStage: "COMPLETE",
      latencyAttempts: 10,
      pingTimeoutMs: 2000,
      downloadConcurrency: 4,
      uploadConcurrency: 4,
      singleDownloadCapBytes: BYTE_CAPS.downloadSingle,
      multiDownloadCapBytes: BYTE_CAPS.downloadMultiTotal,
      singleUploadCapBytes: BYTE_CAPS.uploadSingle,
      multiUploadCapBytes: BYTE_CAPS.uploadMultiTotal,
      totalTrafficCapBytes:
        BYTE_CAPS.downloadMultiTotal + BYTE_CAPS.uploadMultiTotal,
      serverMaxConcurrencySnapshot: 2,
      serverBandwidthMbpsSnapshot: 1000,
      nodeConcurrencySnapshot: null,
      airportConcurrencySnapshot: null,
      startedAt: new Date(),
      finishedAt: new Date(),
    },
  });

  await prisma.speedTestResult.create({
    data: {
      speedTestId: job.id,
      isDemo: true,
      latencyMs: 28.5,
      minLatencyMs: 20,
      maxLatencyMs: 40,
      latencyAvgMs: 29.125,
      latencyP50Ms: 28,
      latencyP90Ms: 37.2,
      latencyAttempts: 10,
      latencySuccessCount: 9,
      downloadMbps: 210.5,
      downloadSingleMbps: 80.25,
      downloadMultiMbps: 210.5,
      uploadMbps: 42,
      uploadSingleMbps: 18.5,
      uploadMultiMbps: 42,
      packetLoss: 10,
      packetLossPercent: 10,
      packetLossTotal: 10,
      packetLossSuccess: 9,
      successRate: 90,
      successRatePercent: 90,
      successRateTotal: 10,
      successRateSuccess: 9,
      stability: null,
      singleThread: false,
      singleDownloadBytes: BYTE_CAPS.downloadSingle,
      singleDownloadDurationMs: 1200,
      singleDownloadStatus: "SUCCESS",
      multiDownloadBytes: BYTE_CAPS.downloadMultiTotal,
      multiDownloadDurationMs: 900,
      multiDownloadConcurrency: 4,
      multiDownloadStatus: "PARTIAL",
      singleUploadBytes: BYTE_CAPS.uploadSingle,
      singleUploadDurationMs: 800,
      singleUploadStatus: "TIMEOUT",
      multiUploadBytes: 0,
      multiUploadDurationMs: null,
      multiUploadConcurrency: 4,
      multiUploadStatus: "SKIPPED",
      skippedStages: ["MULTI_UPLOAD"],
      errorCode: "UPLOAD_TIMEOUT",
      errorMessage: "上传测速超时。",
      exitVerified: true,
      directIdentityHash: DIRECT_HASH,
      proxiedIdentityHash: PROXIED_HASH,
    },
  });

  const stored = await prisma.speedTest.findUnique({
    where: { id: job.id },
    include: { result: true, node: true },
  });
  assert.ok(stored?.result);
  assert.equal(stored.testVersion, "3b3-v1");
  assert.equal(stored.currentStage, "COMPLETE");
  assert.equal(Number(stored.result.latencyP50Ms), 28);
  assert.equal(Number(stored.result.latencyP90Ms), 37.2);
  assert.equal(stored.result.packetLossTotal, 10);
  assert.equal(stored.result.packetLossSuccess, 9);
  assert.equal(stored.result.successRateTotal, 10);
  assert.equal(stored.result.successRateSuccess, 9);
  assert.equal(stored.result.singleDownloadStatus, "SUCCESS");
  assert.equal(stored.result.multiDownloadStatus, "PARTIAL");
  assert.equal(stored.result.singleUploadStatus, "TIMEOUT");
  assert.equal(stored.result.multiUploadStatus, "SKIPPED");
  assert.deepEqual(stored.result.skippedStages, ["MULTI_UPLOAD"]);
  assert.equal(stored.result.exitVerified, true);
  assert.equal(stored.result.directIdentityHash, DIRECT_HASH);
  assert.equal(stored.result.proxiedIdentityHash, PROXIED_HASH);
  assert.equal(stored.result.stability, null);
  assert.equal(stored.result.isDemo, true);
  assert.equal(stored.nodeConcurrencySnapshot, null);
  assert.equal(stored.airportConcurrencySnapshot, null);

  const publicView = mapSpeedTest({
    ...stored,
    airport: { name: "3B-3B 测试机场", slug },
    node: { name: stored.node?.name ?? "" },
    server: { id: serverId, name: "schema-test-server" },
  });
  const json = JSON.stringify(publicView);
  assert.equal(publicView.result?.latencyP50Ms, 28);
  assert.equal(publicView.result?.singleDownloadStatus, "SUCCESS");
  assert.equal(publicView.result?.multiDownloadStatus, "PARTIAL");
  assert.equal(publicView.result?.singleUploadStatus, "TIMEOUT");
  assert.equal(publicView.result?.multiUploadStatus, "SKIPPED");
  assert.equal(publicView.result?.exitVerified, true);
  assert.equal(publicView.result?.isDemo, true);
  assert.equal("directIdentityHash" in (publicView.result ?? {}), false);
  assert.equal("proxiedIdentityHash" in (publicView.result ?? {}), false);
  assert.equal("rawConfig" in publicView, false);
  assert.equal(json.includes(DIRECT_HASH), false);
  assert.equal(json.includes(PROXIED_HASH), false);
  assert.equal(json.includes(SECRET), false);
  assert.equal(json.includes(UUID), false);
  assert.equal(json.includes(TOKEN), false);
  for (const key of PUBLIC_SPEEDTEST_HIDDEN_KEYS) {
    assert.equal(json.includes(`"${key}"`), false);
  }
});

test("legacy result rows keep new raw fields null after migration", async () => {
  const job = await prisma.speedTest.create({
    data: {
      airportId,
      nodeId,
      serverId,
      status: "SUCCESS",
      mode: "SINGLE_THREAD",
      concurrency: 1,
      region: "香港",
      isDemo: true,
    },
  });
  await prisma.speedTestResult.create({
    data: {
      speedTestId: job.id,
      latencyMs: 50,
      downloadMbps: 70,
      uploadMbps: 15,
      packetLoss: 0.5,
      successRate: 99,
      stability: 88,
      isDemo: true,
    },
  });
  const stored = await prisma.speedTestResult.findUnique({
    where: { speedTestId: job.id },
  });
  assert.equal(stored?.latencyP50Ms, null);
  assert.equal(stored?.packetLossTotal, null);
  assert.equal(stored?.singleDownloadBytes, null);
  assert.equal(stored?.exitVerified, null);
  assert.equal(stored?.skippedStages, null);
  assert.equal(stored?.isDemo, true);
  const mapped = mapResultMetrics({
    ...stored!,
    testedAt: stored!.testedAt,
  });
  assert.equal(mapped.latencyP50Ms, null);
  assert.equal(mapped.singleDownloadBytes, null);
  assert.equal(mapped.exitVerified, null);
});

test("public speed-test API omits identity hashes and node secrets", async () => {
  const job = await prisma.speedTest.create({
    data: {
      airportId,
      nodeId,
      serverId,
      status: "SUCCESS",
      mode: "SINGLE_THREAD",
      concurrency: 1,
      region: "香港",
      isDemo: true,
      finishedAt: new Date(),
    },
  });
  await prisma.speedTestResult.create({
    data: {
      speedTestId: job.id,
      latencyMs: 33,
      downloadMbps: 64,
      uploadMbps: 12,
      isDemo: true,
      directIdentityHash: DIRECT_HASH,
      proxiedIdentityHash: PROXIED_HASH,
      exitVerified: false,
    },
  });

  const speedTests = await getSpeedTests();
  const speedBody = await speedTests.json();
  const blob = JSON.stringify(speedBody);
  assert.equal(blob.includes(DIRECT_HASH), false);
  assert.equal(blob.includes(PROXIED_HASH), false);
  assert.equal(containsSecret(blob, [SECRET, UUID, TOKEN]), false);
  assert.equal(blob.includes("rawConfig"), false);

  const airport = await getAirport(new Request(`http://127.0.0.1/api/airports/${slug}`), {
    params: Promise.resolve({ slug }),
  });
  const airportBody = await airport.json();
  const airportBlob = JSON.stringify(airportBody);
  assert.equal(containsSecret(airportBlob, [SECRET, UUID, TOKEN]), false);
  assert.equal(airportBlob.includes("rawConfig"), false);
  assert.equal(airportBlob.includes(DIRECT_HASH), false);
});
