import { getPrisma } from "@/lib/prisma";
import { createSpeedTestJob } from "@/lib/speedtest/jobs";
import { claimNextPendingJob } from "@/lib/speedtest/worker";
import type {
  CreateSpeedTestJobInput,
  SpeedTestJobQueue,
} from "@/lib/speedtest/types";
import type { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * PostgreSQL-backed job queue. Replace this class with a Redis/BullMQ
 * adapter later without changing Worker orchestration.
 */
export class PrismaSpeedTestJobQueue implements SpeedTestJobQueue {
  constructor(private prisma: PrismaClient = getPrisma()) {}

  async enqueue(input: CreateSpeedTestJobInput) {
    const job = await createSpeedTestJob(input, this.prisma);
    return { id: job.id, status: job.status };
  }

  claimNext() {
    return claimNextPendingJob(this.prisma);
  }
}
