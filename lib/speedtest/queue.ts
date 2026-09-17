import type { CreateSpeedTestJob, SpeedTestJob } from "@/lib/speedtest/types";

const jobs = new Map<string, SpeedTestJob>();

export function saveJob(job: SpeedTestJob) {
  jobs.set(job.id, job);
}

export function readJob(id: string) {
  return jobs.get(id) ?? null;
}

export function listJobs() {
  return [...jobs.values()].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1
  );
}

export function createPendingJob(payload: CreateSpeedTestJob): SpeedTestJob {
  const now = new Date().toISOString();
  return {
    id: `job_${crypto.randomUUID()}`,
    status: "PENDING",
    payload,
    createdAt: now,
    startedAt: null,
    finishedAt: null,
    metrics: null,
    errorMessage: null,
  };
}
