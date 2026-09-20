import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Prisma } from "../lib/generated/prisma/client";
import { mapSpeedTest } from "../lib/data/mappers";
import { getPrisma, pingDatabase } from "../lib/prisma";
import {
  DEFAULT_LATENCY_ATTEMPTS,
  DEFAULT_PING_TIMEOUT_MS,
  SPEED_TEST_VERSION,
} from "../lib/speedtest/constants";
import { BYTE_CAPS } from "../lib/speedtest/metrics";
import { totalTrafficCapBytes } from "../lib/speedtest/job-params";
import { createSpeedTestJob } from "../lib/speedtest/jobs";
import {
  claimNextPendingJob,
  processNextJob,
} from "../lib/speedtest/worker";
import { createSpeedTestExecutor } from "../lib/speedtest/executor-factory";
import { REAL_PRODUCTION_GATE_OPEN } from "../lib/speedtest/exit-identity";

const prisma = getPrisma();
const suffix = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
const airportId = `test_p1_ap_${suffix}`;
const nodeId = `test_p1_node_${suffix}`;
const nodeIdB = `test_p1_node_b_${suffix}`;
const serverId = `test_p1_srv_${suffix}`;
const SECRET = "phase1-should-never-appear";

async function cancelOpenJobs() {
  await prisma.speedTest.updateMany({
    where: {
      OR: [{ airportId }, { serverId }, { nodeId: { in: [nodeId, nodeIdB] } }],
      status: { in: ["PENDING", "RUNNING"] },
    },
    data: { status: "CANCELLED", finishedAt: new Date() },
  });
}

async function cleanup() {
  await prisma.speedTest.deleteMany({
    where: {
      OR: [{ airportId }, { serverId }, { nodeId: { in: [nodeId, nodeIdB] } }],
    },
  });
  await prisma.node.deleteMany({ where: { id: { in: [nodeId, nodeIdB] } } });
  await prisma.airport.deleteMany({ where: { id: airportId } });
  await prisma.speedTestServer.deleteMany({ where: { id: serverId } });
}

before(async () => {
  const database = await pingDatabase();
  if (database !== "connected") {
    throw new Error("PostgreSQL is required for phase 1 capacity tests");
  }
  await cleanup();
  await prisma.airport.create({
    data: {
      id: airportId,
      name: "Phase1 测试机场",
      slug: `test-p1-${suffix}`,
      summary: "capacity",
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
      fingerprint: `fp_p1_${suffix}`,
      rawConfig: JSON.stringify({
        type: "ss",
        password: SECRET,
        server: "hk.example.invalid",
        port: 8388,
      }),
    },
  });
  await prisma.node.create({
    data: {
      id: nodeIdB,
      airportId,
      name: "香港 02",
      region: "香港",
      kind: "中转",
      status: "ACTIVE",
      isDemo: true,
    },
  });
  await prisma.speedTestServer.create({
    data: {
      id: serverId,
      name: "phase1-server",
      region: "香港",
      countryCode: "HK",
      city: "香港",
      bandwidthMbps: 1000,
      maxConcurrentTests: 2,
      status: "ACTIVE",
      isDemo: true,
      endpoint: null,
    },
  });
});

after(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test("schema has capacity fields and SpeedTestSample", () => {
  const airportFields = new Set<string>(Object.values(Prisma.AirportScalarFieldEnum));
  const nodeFields = new Set<string>(Object.values(Prisma.NodeScalarFieldEnum));
  const sampleFields = new Set<string>(Object.values(Prisma.SpeedTestSampleScalarFieldEnum));
  assert.equal(airportFields.has("maxConcurrentTests"), true);
  assert.equal(nodeFields.has("maxConcurrentTests"), true);
  for (const field of [
    "speedTestId",
    "stage",
    "seq",
    "ok",
    "bytes",
    "durationMs",
    "statusCode",
    "errorCode",
    "startedAt",
  ]) {
    assert.equal(sampleFields.has(field), true, `SpeedTestSample.${field}`);
  }
  assert.equal(sampleFields.has("rawConfig"), false);
  assert.equal(createSpeedTestExecutor().kind, "mock");
  assert.equal(REAL_PRODUCTION_GATE_OPEN, false);
});

test("new Airport and Node default maxConcurrentTests to 1", async () => {
  const airport = await prisma.airport.findUnique({ where: { id: airportId } });
  const node = await prisma.node.findUnique({ where: { id: nodeId } });
  assert.equal(airport?.maxConcurrentTests, 1);
  assert.equal(node?.maxConcurrentTests, 1);
});

test("maxConcurrentTests cannot be less than 1", async () => {
  await assert.rejects(() =>
    prisma.airport.update({
      where: { id: airportId },
      data: { maxConcurrentTests: 0 },
    })
  );
  await assert.rejects(() =>
    prisma.node.update({
      where: { id: nodeId },
      data: { maxConcurrentTests: 0 },
    })
  );
  const airport = await prisma.airport.findUnique({ where: { id: airportId } });
  const node = await prisma.node.findUnique({ where: { id: nodeId } });
  assert.equal(airport?.maxConcurrentTests, 1);
  assert.equal(node?.maxConcurrentTests, 1);
});

test("createSpeedTestJob snapshots version, caps, and concurrency", async () => {
  await cancelOpenJobs();
  const job = await createSpeedTestJob(
    {
      airportId,
      nodeId,
      speedTestServerId: serverId,
      concurrency: 4,
      isDemo: true,
    },
    prisma
  );

  assert.equal(job.status, "PENDING");
  assert.equal(job.isDemo, true);
  assert.equal(job.testVersion, SPEED_TEST_VERSION);
  assert.equal(job.latencyAttempts, DEFAULT_LATENCY_ATTEMPTS);
  assert.equal(job.pingTimeoutMs, DEFAULT_PING_TIMEOUT_MS);
  assert.equal(job.downloadConcurrency, 4);
  assert.equal(job.uploadConcurrency, 4);
  assert.equal(job.singleDownloadCapBytes, BYTE_CAPS.downloadSingle);
  assert.equal(job.multiDownloadCapBytes, BYTE_CAPS.downloadMultiTotal);
  assert.equal(job.singleUploadCapBytes, BYTE_CAPS.uploadSingle);
  assert.equal(job.multiUploadCapBytes, BYTE_CAPS.uploadMultiTotal);
  assert.equal(job.totalTrafficCapBytes, totalTrafficCapBytes());
  assert.equal(job.serverMaxConcurrencySnapshot, 2);
  assert.equal(job.serverBandwidthMbpsSnapshot, 1000);
  assert.equal(job.nodeConcurrencySnapshot, 1);
  assert.equal(job.airportConcurrencySnapshot, 1);

  const row = JSON.stringify(job);
  assert.equal(row.includes(SECRET), false);
  assert.equal(row.includes("rawConfig"), false);
  assert.equal("rawConfig" in job, false);

  const publicView = mapSpeedTest(job);
  const publicJson = JSON.stringify(publicView);
  assert.equal(publicView.testVersion, SPEED_TEST_VERSION);
  assert.equal(publicView.airportConcurrencySnapshot, 1);
  assert.equal(publicView.nodeConcurrencySnapshot, 1);
  assert.equal(publicJson.includes(SECRET), false);
  assert.equal(publicJson.includes("rawConfig"), false);
});

test("airport maxConcurrentTests blocks a second claim", async () => {
  await cancelOpenJobs();
  await prisma.airport.update({
    where: { id: airportId },
    data: { maxConcurrentTests: 1 },
  });
  await prisma.node.update({
    where: { id: nodeId },
    data: { maxConcurrentTests: 2 },
  });
  await prisma.node.update({
    where: { id: nodeIdB },
    data: { maxConcurrentTests: 2 },
  });
  await prisma.speedTestServer.update({
    where: { id: serverId },
    data: { maxConcurrentTests: 2 },
  });

  const first = await createSpeedTestJob(
    { airportId, nodeId, speedTestServerId: serverId },
    prisma
  );
  const second = await createSpeedTestJob(
    { airportId, nodeId: nodeIdB, speedTestServerId: serverId },
    prisma
  );

  const claimed = await claimNextPendingJob(prisma, { serverId });
  assert.equal(claimed?.id, first.id);
  const blocked = await claimNextPendingJob(prisma, { serverId });
  assert.equal(blocked, null);
  const pending = await prisma.speedTest.findUnique({ where: { id: second.id } });
  assert.equal(pending?.status, "PENDING");
});

test("node maxConcurrentTests blocks a second claim on the same node", async () => {
  await cancelOpenJobs();
  await prisma.airport.update({
    where: { id: airportId },
    data: { maxConcurrentTests: 2 },
  });
  await prisma.node.update({
    where: { id: nodeId },
    data: { maxConcurrentTests: 1 },
  });
  await prisma.speedTestServer.update({
    where: { id: serverId },
    data: { maxConcurrentTests: 2 },
  });

  const first = await createSpeedTestJob(
    { airportId, nodeId, speedTestServerId: serverId },
    prisma
  );
  const second = await createSpeedTestJob(
    { airportId, nodeId, speedTestServerId: serverId },
    prisma
  );

  const claimed = await claimNextPendingJob(prisma, { serverId });
  assert.equal(claimed?.id, first.id);
  const blocked = await claimNextPendingJob(prisma, { serverId });
  assert.equal(blocked, null);
  const pending = await prisma.speedTest.findUnique({ where: { id: second.id } });
  assert.equal(pending?.status, "PENDING");
});

test("different nodes can be claimed when airport and server allow it", async () => {
  await cancelOpenJobs();
  await prisma.airport.update({
    where: { id: airportId },
    data: { maxConcurrentTests: 2 },
  });
  await prisma.node.update({
    where: { id: nodeId },
    data: { maxConcurrentTests: 1 },
  });
  await prisma.node.update({
    where: { id: nodeIdB },
    data: { maxConcurrentTests: 1 },
  });
  await prisma.speedTestServer.update({
    where: { id: serverId },
    data: { maxConcurrentTests: 2 },
  });

  const first = await createSpeedTestJob(
    { airportId, nodeId, speedTestServerId: serverId },
    prisma
  );
  const second = await createSpeedTestJob(
    { airportId, nodeId: nodeIdB, speedTestServerId: serverId },
    prisma
  );

  const claimedA = await claimNextPendingJob(prisma, { serverId });
  const claimedB = await claimNextPendingJob(prisma, { serverId });
  const ids = [claimedA?.id, claimedB?.id].sort();
  assert.deepEqual(ids, [first.id, second.id].sort());
});

test("mock worker still writes SUCCESS without SpeedTestSample rows", async () => {
  await cancelOpenJobs();
  await prisma.airport.update({
    where: { id: airportId },
    data: { maxConcurrentTests: 1 },
  });
  await prisma.node.update({
    where: { id: nodeId },
    data: { maxConcurrentTests: 1 },
  });
  await prisma.speedTestServer.update({
    where: { id: serverId },
    data: { maxConcurrentTests: 1 },
  });

  const job = await createSpeedTestJob(
    {
      airportId,
      nodeId,
      speedTestServerId: serverId,
      concurrency: 1,
      isDemo: true,
    },
    prisma
  );
  const result = await processNextJob({ prisma, serverId });
  assert.deepEqual(result, {
    claimed: true,
    jobId: job.id,
    status: "SUCCESS",
  });

  const stored = await prisma.speedTest.findUnique({
    where: { id: job.id },
    include: { result: true, samples: true },
  });
  assert.equal(stored?.status, "SUCCESS");
  assert.equal(stored?.result?.isDemo, true);
  assert.equal(stored?.samples.length, 0);
  assert.ok(Number(stored?.result?.downloadSingleMbps) >= 20);
});

test("SpeedTestSample stores only non-secret attempt fields", async () => {
  await cancelOpenJobs();
  const job = await createSpeedTestJob(
    { airportId, nodeId, speedTestServerId: serverId },
    prisma
  );
  const sample = await prisma.speedTestSample.create({
    data: {
      speedTestId: job.id,
      stage: "LATENCY",
      seq: 0,
      ok: true,
      bytes: 128,
      durationMs: 42,
      statusCode: 200,
      errorCode: null,
      startedAt: new Date(),
    },
  });
  const keys = Object.keys(sample);
  assert.equal(keys.includes("rawConfig"), false);
  assert.equal(JSON.stringify(sample).includes(SECRET), false);
  assert.equal(sample.ok, true);
  assert.equal(sample.seq, 0);
});
