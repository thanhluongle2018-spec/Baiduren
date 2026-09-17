import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { getPrisma, pingDatabase } from "../lib/prisma";
import { loadDatabaseOrDemo } from "../lib/data/source";
import { SpeedTestJobError } from "../lib/speedtest/errors";
import { createSpeedTestJob } from "../lib/speedtest/jobs";
import {
  claimNextPendingJob,
  processNextJob,
} from "../lib/speedtest/worker";
import type { SpeedTestExecutor } from "../lib/speedtest/types";

const prisma = getPrisma();
const suffix = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
const airportId = `test3a_ap_${suffix}`;
const nodeId = `test3a_node_${suffix}`;
const serverId = `test3a_srv_${suffix}`;
const disabledServerId = `test3a_srv_disabled_${suffix}`;

async function cancelOpenJobs() {
  await prisma.speedTest.updateMany({
    where: {
      serverId: { in: [serverId, disabledServerId] },
      status: { in: ["PENDING", "RUNNING"] },
    },
    data: { status: "CANCELLED", finishedAt: new Date() },
  });
}

async function cleanup() {
  await prisma.speedTest.deleteMany({
    where: {
      OR: [
        { airportId },
        { serverId: { in: [serverId, disabledServerId] } },
      ],
    },
  });
  await prisma.node.deleteMany({ where: { id: nodeId } });
  await prisma.airport.deleteMany({ where: { id: airportId } });
  await prisma.speedTestServer.deleteMany({
    where: { id: { in: [serverId, disabledServerId] } },
  });
}

before(async () => {
  const database = await pingDatabase();
  if (database !== "connected") {
    throw new Error("PostgreSQL is required for worker integration tests");
  }
  await cleanup();
  await prisma.airport.create({
    data: {
      id: airportId,
      name: "测试机场",
      slug: `test-3a-${suffix}`,
      summary: "worker integration",
      status: "ACTIVE",
      isDemo: true,
    },
  });
  await prisma.node.create({
    data: {
      id: nodeId,
      airportId,
      name: "测试节点",
      region: "香港",
      kind: "中转",
      status: "ACTIVE",
      isDemo: true,
    },
  });
  await prisma.speedTestServer.create({
    data: {
      id: serverId,
      name: "test-server",
      region: "香港",
      countryCode: "HK",
      city: "香港",
      bandwidthMbps: 1000,
      maxConcurrentTests: 1,
      status: "ACTIVE",
      isDemo: true,
    },
  });
  await prisma.speedTestServer.create({
    data: {
      id: disabledServerId,
      name: "test-server-disabled",
      region: "日本",
      countryCode: "JP",
      city: "东京",
      bandwidthMbps: 1000,
      maxConcurrentTests: 2,
      status: "DISABLED",
      isDemo: true,
    },
  });
});

after(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test("createSpeedTestJob writes a PENDING demo job", async () => {
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
  assert.equal(job.status, "PENDING");
  assert.equal(job.isDemo, true);
  assert.equal(job.concurrency, 1);
  assert.equal(job.serverId, serverId);
});

test("createSpeedTestJob rejects concurrency outside 1-8", async () => {
  await assert.rejects(
    () =>
      createSpeedTestJob(
        {
          airportId,
          nodeId,
          speedTestServerId: serverId,
          concurrency: 9,
        },
        prisma
      ),
    (error: unknown) =>
      error instanceof SpeedTestJobError && error.code === "INVALID_CONCURRENCY"
  );
});

test("DISABLED server cannot create jobs", async () => {
  await assert.rejects(
    () =>
      createSpeedTestJob(
        {
          airportId,
          nodeId,
          speedTestServerId: disabledServerId,
        },
        prisma
      ),
    (error: unknown) =>
      error instanceof SpeedTestJobError && error.code === "SERVER_DISABLED"
  );
});

test("worker claims a PENDING job and mock executor writes SUCCESS + result", async () => {
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
  const result = await processNextJob({ prisma, serverId });
  assert.deepEqual(result, {
    claimed: true,
    jobId: job.id,
    status: "SUCCESS",
  });

  const stored = await prisma.speedTest.findUnique({
    where: { id: job.id },
    include: { result: true },
  });
  assert.equal(stored?.status, "SUCCESS");
  assert.ok(stored?.startedAt);
  assert.ok(stored?.finishedAt);
  assert.ok(stored?.result);
  assert.equal(stored?.result.isDemo, true);
  assert.ok(Number(stored?.result.downloadSingleMbps) >= 20);
  assert.ok(Number(stored?.result.downloadMultiMbps) >= 50);
});

test("executor exceptions mark FAILED and keep errorMessage", async () => {
  await cancelOpenJobs();
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
  const exploding: SpeedTestExecutor = {
    kind: "mock",
    async run() {
      throw new Error("simulated boom");
    },
  };
  const result = await processNextJob({ prisma, executor: exploding, serverId });
  assert.equal(result.claimed, true);
  if (result.claimed) assert.equal(result.status, "FAILED");

  const stored = await prisma.speedTest.findUnique({ where: { id: job.id } });
  assert.equal(stored?.status, "FAILED");
  assert.equal(stored?.errorMessage, "模拟测速执行失败（Error）。");
});

test("maxConcurrentTests blocks additional claims while RUNNING", async () => {
  await cancelOpenJobs();

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

  await prisma.speedTest.update({
    where: { id: first.id },
    data: { status: "SUCCESS", finishedAt: new Date() },
  });
  const released = await claimNextPendingJob(prisma, { serverId });
  assert.equal(released?.id, second.id);
});

test("two workers cannot claim the same PENDING job", async () => {
  await cancelOpenJobs();
  await prisma.speedTestServer.update({
    where: { id: serverId },
    data: { maxConcurrentTests: 2 },
  });

  const job = await createSpeedTestJob(
    { airportId, nodeId, speedTestServerId: serverId },
    prisma
  );
  const [left, right] = await Promise.all([
    claimNextPendingJob(prisma, { serverId }),
    claimNextPendingJob(prisma, { serverId }),
  ]);
  const claimedIds = [left?.id, right?.id].filter(Boolean);
  assert.equal(claimedIds.length, 1);
  assert.equal(claimedIds[0], job.id);

  await prisma.speedTestServer.update({
    where: { id: serverId },
    data: { maxConcurrentTests: 1 },
  });
});

test("DISABLED server jobs are not claimed", async () => {
  const job = await prisma.speedTest.create({
    data: {
      airportId,
      nodeId,
      serverId: disabledServerId,
      status: "PENDING",
      mode: "SINGLE_THREAD",
      concurrency: 1,
      region: "日本",
      isDemo: true,
    },
  });
  const claimed = await claimNextPendingJob(prisma, { serverId: disabledServerId });
  assert.equal(claimed, null);
  const stored = await prisma.speedTest.findUnique({ where: { id: job.id } });
  assert.equal(stored?.status, "PENDING");
});

test("missing airport / node / server are typed errors", async () => {
  await assert.rejects(
    () =>
      createSpeedTestJob(
        {
          airportId: "missing-airport",
          nodeId,
          speedTestServerId: serverId,
        },
        prisma
      ),
    (error: unknown) =>
      error instanceof SpeedTestJobError && error.code === "AIRPORT_NOT_FOUND"
  );
  await assert.rejects(
    () =>
      createSpeedTestJob(
        {
          airportId,
          nodeId: "missing-node",
          speedTestServerId: serverId,
        },
        prisma
      ),
    (error: unknown) =>
      error instanceof SpeedTestJobError && error.code === "NODE_NOT_FOUND"
  );
  await assert.rejects(
    () =>
      createSpeedTestJob(
        {
          airportId,
          nodeId,
          speedTestServerId: "missing-server",
        },
        prisma
      ),
    (error: unknown) =>
      error instanceof SpeedTestJobError && error.code === "SERVER_NOT_FOUND"
  );
});

test("database loader falls back to demo data when the query fails", async () => {
  const payload = await loadDatabaseOrDemo(async () => {
    throw new Error("synthetic database failure");
  }, ["demo-fallback"]);
  assert.deepEqual(payload, {
    demo: true,
    source: "demo",
    data: ["demo-fallback"],
  });
});
