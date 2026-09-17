import { Prisma } from "@/lib/generated/prisma/client";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { HEARTBEAT_INTERVAL_MS } from "@/lib/speedtest/constants";
import { storedExecutorErrorMessage } from "@/lib/speedtest/errors";
import { mockSpeedTestExecutor } from "@/lib/speedtest/mock-executor";
import {
  applyStatusTransition,
  clearedLease,
  extendJobLease,
  nextLeaseExpiry,
  reapExpiredLeases,
} from "@/lib/speedtest/transitions";
import type {
  ClaimedSpeedTestJob,
  MockSpeedTestMetrics,
  SpeedTestExecutor,
} from "@/lib/speedtest/types";

type ClaimRow = {
  id: string;
  serverId: string;
};

export type ClaimJobOptions = {
  serverId?: string;
};

function toClaimedJob(row: {
  id: string;
  airportId: string;
  nodeId: string | null;
  serverId: string | null;
  region: string;
  concurrency: number;
  isDemo: boolean;
  airport: { name: string };
  node: { name: string } | null;
  server: { name: string } | null;
}): ClaimedSpeedTestJob {
  return {
    id: row.id,
    airportId: row.airportId,
    nodeId: row.nodeId,
    serverId: row.serverId,
    region: row.region,
    concurrency: row.concurrency,
    isDemo: row.isDemo,
    airportName: row.airport.name,
    nodeName: row.node?.name ?? null,
    serverName: row.server?.name ?? null,
  };
}

function skipIdsSql(ids: string[]) {
  if (ids.length === 0) return Prisma.sql``;
  return Prisma.sql`AND st.id NOT IN (${Prisma.join(ids)})`;
}

const claimedInclude = {
  airport: { select: { name: true } },
  node: { select: { name: true } },
  server: { select: { name: true } },
} as const;

/**
 * Claim one PENDING job using a database lock.
 * Concurrent workers cannot receive the same row (FOR UPDATE SKIP LOCKED).
 * Server capacity is re-checked after locking SpeedTestServer so maxConcurrentTests
 * is recovered from PostgreSQL, not from process memory.
 */
export async function claimNextPendingJob(
  prisma: PrismaClient = getPrisma(),
  options: ClaimJobOptions = {}
): Promise<ClaimedSpeedTestJob | null> {
  return prisma.$transaction(async (tx) => {
    const skippedJobIds: string[] = [];
    const serverFilter = options.serverId
      ? Prisma.sql`AND st."serverId" = ${options.serverId}`
      : Prisma.sql``;

    for (let attempt = 0; attempt < 16; attempt += 1) {
      const candidates = await tx.$queryRaw<ClaimRow[]>`
        SELECT st.id, st."serverId"
        FROM "SpeedTest" st
        INNER JOIN "SpeedTestServer" srv ON srv.id = st."serverId"
        WHERE st.status = 'PENDING'::"SpeedTestStatus"
          AND st."serverId" IS NOT NULL
          AND srv.status = 'ACTIVE'::"SpeedTestServerStatus"
          AND (
            SELECT COUNT(*)::int
            FROM "SpeedTest" running
            WHERE running."serverId" = st."serverId"
              AND running.status = 'RUNNING'::"SpeedTestStatus"
          ) < srv."maxConcurrentTests"
          ${serverFilter}
          ${skipIdsSql(skippedJobIds)}
        ORDER BY st."createdAt" ASC
        FOR UPDATE OF st SKIP LOCKED
        LIMIT 1
      `;

      const candidate = candidates[0];
      if (!candidate) return null;

      const servers = await tx.$queryRaw<
        Array<{ id: string; maxConcurrentTests: number; status: string }>
      >`
        SELECT id, "maxConcurrentTests", status::text AS status
        FROM "SpeedTestServer"
        WHERE id = ${candidate.serverId}
        FOR UPDATE
      `;
      const server = servers[0];
      if (!server || server.status !== "ACTIVE") {
        skippedJobIds.push(candidate.id);
        continue;
      }

      const running = await tx.speedTest.count({
        where: { serverId: candidate.serverId, status: "RUNNING" },
      });
      if (running >= server.maxConcurrentTests) {
        skippedJobIds.push(candidate.id);
        continue;
      }

      const now = new Date();
      const moved = await applyStatusTransition(tx, {
        id: candidate.id,
        from: ["PENDING", "QUEUED"],
        to: "RUNNING",
        data: {
          startedAt: now,
          errorMessage: null,
          leaseExpiresAt: nextLeaseExpiry(now),
          heartbeatAt: now,
        },
      });
      if (moved.count !== 1) {
        skippedJobIds.push(candidate.id);
        continue;
      }

      const updated = await tx.speedTest.findUnique({
        where: { id: candidate.id },
        include: claimedInclude,
      });
      if (!updated) return null;
      return toClaimedJob(updated);
    }

    return null;
  });
}

function resultWriteData(job: ClaimedSpeedTestJob, metrics: MockSpeedTestMetrics) {
  const downloadMbps = job.concurrency > 1
    ? metrics.downloadMultiMbps
    : metrics.downloadSingleMbps;
  const uploadMbps = job.concurrency > 1
    ? metrics.uploadMultiMbps
    : metrics.uploadSingleMbps;

  return {
    latencyMs: metrics.latencyMs,
    minLatencyMs: metrics.minLatencyMs,
    maxLatencyMs: metrics.maxLatencyMs,
    downloadMbps,
    downloadSingleMbps: metrics.downloadSingleMbps,
    downloadMultiMbps: metrics.downloadMultiMbps,
    uploadMbps,
    uploadSingleMbps: metrics.uploadSingleMbps,
    uploadMultiMbps: metrics.uploadMultiMbps,
    packetLoss: metrics.packetLossPercent,
    packetLossPercent: metrics.packetLossPercent,
    successRate: metrics.successRatePercent,
    successRatePercent: metrics.successRatePercent,
    stability: metrics.stability,
    singleThread: metrics.singleThread,
    testedAt: new Date(),
    isDemo: true,
  };
}

export async function markJobFailed(
  jobId: string,
  errorMessage: string,
  prisma: PrismaClient = getPrisma()
) {
  const now = new Date();
  await applyStatusTransition(prisma, {
    id: jobId,
    from: "RUNNING",
    to: "FAILED",
    data: {
      finishedAt: now,
      errorMessage,
      ...clearedLease,
    },
  });
  return prisma.speedTest.findUnique({
    where: { id: jobId },
  });
}

export async function persistSuccessfulResult(
  job: ClaimedSpeedTestJob,
  metrics: MockSpeedTestMetrics,
  prisma: PrismaClient = getPrisma()
) {
  return prisma.$transaction(async (tx) => {
    const moved = await applyStatusTransition(tx, {
      id: job.id,
      from: "RUNNING",
      to: "SUCCESS",
      data: {
        finishedAt: new Date(),
        errorMessage: null,
        ...clearedLease,
      },
    });
    if (moved.count !== 1) {
      return null;
    }

    await tx.speedTestResult.upsert({
      where: { speedTestId: job.id },
      update: resultWriteData(job, metrics),
      create: {
        speedTestId: job.id,
        ...resultWriteData(job, metrics),
      },
    });

    return tx.speedTest.findUnique({
      where: { id: job.id },
    });
  });
}

export type ProcessNextJobResult =
  | { claimed: false }
  | { claimed: true; jobId: string; status: "SUCCESS" | "FAILED" };

function startLeaseHeartbeat(prisma: PrismaClient, jobId: string) {
  const timer = setInterval(() => {
    void extendJobLease(prisma, jobId).catch(() => undefined);
  }, HEARTBEAT_INTERVAL_MS);
  return () => clearInterval(timer);
}

export async function processNextJob(options?: {
  prisma?: PrismaClient;
  executor?: SpeedTestExecutor;
  serverId?: string;
}): Promise<ProcessNextJobResult> {
  const prisma = options?.prisma ?? getPrisma();
  const executor = options?.executor ?? mockSpeedTestExecutor;

  try {
    await reapExpiredLeases(prisma);
  } catch {
    // Reaper failure must not crash the worker loop.
  }

  let claimed: ClaimedSpeedTestJob | null = null;
  try {
    claimed = await claimNextPendingJob(prisma, { serverId: options?.serverId });
  } catch {
    return { claimed: false };
  }

  if (!claimed) return { claimed: false };

  const stopHeartbeat = startLeaseHeartbeat(prisma, claimed.id);
  try {
    if (!claimed.serverId) {
      await markJobFailed(claimed.id, "测速任务未关联测速服务器。", prisma);
      return { claimed: true, jobId: claimed.id, status: "FAILED" };
    }

    const server = await prisma.speedTestServer.findUnique({
      where: { id: claimed.serverId },
      select: { status: true },
    });
    if (!server || server.status !== "ACTIVE") {
      await markJobFailed(
        claimed.id,
        "测速服务器已停用，无法执行任务。",
        prisma
      );
      return { claimed: true, jobId: claimed.id, status: "FAILED" };
    }

    const metrics = await executor.run(claimed);
    const saved = await persistSuccessfulResult(claimed, metrics, prisma);
    if (saved?.status === "SUCCESS") {
      return { claimed: true, jobId: claimed.id, status: "SUCCESS" };
    }

    const current = await prisma.speedTest.findUnique({
      where: { id: claimed.id },
      select: { status: true },
    });
    return {
      claimed: true,
      jobId: claimed.id,
      status: current?.status === "SUCCESS" ? "SUCCESS" : "FAILED",
    };
  } catch (error) {
    try {
      await markJobFailed(claimed.id, storedExecutorErrorMessage(error), prisma);
    } catch {
      // Never let persistence errors crash the worker loop.
    }
    return { claimed: true, jobId: claimed.id, status: "FAILED" };
  } finally {
    stopHeartbeat();
  }
}

export async function runWorkerLoop(options?: {
  prisma?: PrismaClient;
  executor?: SpeedTestExecutor;
  idleMs?: number;
  signal?: AbortSignal;
  serverId?: string;
}) {
  const idleMs = options?.idleMs ?? 1500;
  while (!options?.signal?.aborted) {
    const result = await processNextJob({
      prisma: options?.prisma,
      executor: options?.executor,
      serverId: options?.serverId,
    });
    if (!result.claimed) {
      await new Promise((resolve) => setTimeout(resolve, idleMs));
    }
  }
}
