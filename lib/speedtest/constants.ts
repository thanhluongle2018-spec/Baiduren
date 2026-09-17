import type { SpeedTestStatus } from "@/types";

export const MIN_CONCURRENCY = 1;
export const MAX_CONCURRENCY = 8;
export const DEFAULT_CONCURRENCY = 1;
export const MULTI_THREAD_CONCURRENCY = 4;

export const SUCCESSFUL_STATUSES: SpeedTestStatus[] = ["SUCCESS", "COMPLETED"];

export const RANKING_WINDOW_MS = 24 * 60 * 60 * 1000;
export const RECENT_JOB_LIMIT = 50;
