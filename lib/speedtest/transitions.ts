import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import type { SpeedTestStatus } from "@/types";
import {
  LEASE_DURATION_MS,
  LEASE_TIMEOUT_MESSAGE,
} from "@/lib/speedtest/constants";
import { assertTransition } from "@/lib/speedtest/state-machine";

type SpeedTestDb = {
  speedTest: Pick<PrismaClient["speedTest"], "updateMany">;
};

export function nextLeaseExpiry(now = new Date(), durationMs = LEASE_DURATION_MS) {
  return new Date(now.getTime() + durationMs);
}

export const clearedLease = {
  leaseExpiresAt: null,
  heartbeatAt: null,
} as const;

/**
 * Single DB entry for legal status changes.
 * Updates only apply when the row is still in an allowed `from` status.
 */
export async function applyStatusTransition(
  db: SpeedTestDb,
  params: {
    id: string;
    from: SpeedTestStatus | SpeedTestStatus[];
    to: SpeedTestStatus;
    data?: Prisma.SpeedTestUpdateManyMutationInput;
  }
) {
  const fromList = Array.isArray(params.from) ? params.from : [params.from];
  for (const from of fromList) {
    assertTransition(from, params.to);
  }

  return db.speedTest.updateMany({
    where: {
      id: params.id,
      status: { in: fromList },
    },
    data: {
      status: params.to,
      ...params.data,
    },
  });
}

export async function extendJobLease(
  db: SpeedTestDb,
  jobId: string,
  now = new Date()
) {
  return db.speedTest.updateMany({
    where: { id: jobId, status: "RUNNING" },
    data: {
      leaseExpiresAt: nextLeaseExpiry(now),
      heartbeatAt: now,
    },
  });
}

/**
 * Fail RUNNING jobs whose lease has expired, including older rows without a lease.
 * Uses a status-conditioned update so a live Worker can still complete first.
 */
export async function reapExpiredLeases(
  db: SpeedTestDb,
  now = new Date()
) {
  assertTransition("RUNNING", "FAILED");
  const staleStartedAt = new Date(now.getTime() - LEASE_DURATION_MS);

  return db.speedTest.updateMany({
    where: {
      status: "RUNNING",
      OR: [
        { leaseExpiresAt: { lte: now } },
        {
          leaseExpiresAt: null,
          startedAt: { lte: staleStartedAt },
        },
        {
          leaseExpiresAt: null,
          startedAt: null,
          updatedAt: { lte: staleStartedAt },
        },
      ],
    },
    data: {
      status: "FAILED",
      finishedAt: now,
      errorMessage: LEASE_TIMEOUT_MESSAGE,
      ...clearedLease,
    },
  });
}
