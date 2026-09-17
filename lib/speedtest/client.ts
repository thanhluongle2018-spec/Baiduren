import { createPendingJob, readJob, saveJob } from "@/lib/speedtest/queue";
import type {
  CreateSpeedTestJob,
  SpeedTestJob,
  SpeedTestWorkerClient,
} from "@/lib/speedtest/types";

/**
 * Legacy in-memory stub from earlier phases.
 * Production job creation uses createSpeedTestJob() + PostgreSQL.
 * This client still never probes a node, opens a tunnel, or calls a speed-test API.
 */
export class StubSpeedTestClient implements SpeedTestWorkerClient {
  async enqueue(job: CreateSpeedTestJob): Promise<Pick<SpeedTestJob, "id" | "status">> {
    const record = createPendingJob(job);
    saveJob(record);
    return { id: record.id, status: record.status };
  }

  async getJob(id: string): Promise<SpeedTestJob | null> {
    return readJob(id);
  }
}

export const speedTestClient = new StubSpeedTestClient();
