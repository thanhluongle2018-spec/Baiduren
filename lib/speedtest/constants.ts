import type { SpeedTestStatus } from "@/types";

export const MIN_CONCURRENCY = 1;
export const MAX_CONCURRENCY = 8;
export const DEFAULT_CONCURRENCY = 1;
export const MULTI_THREAD_CONCURRENCY = 4;

export const SUCCESSFUL_STATUSES: SpeedTestStatus[] = ["SUCCESS", "COMPLETED"];

export const RANKING_WINDOW_MS = 24 * 60 * 60 * 1000;
export const RECENT_JOB_LIMIT = 50;

/** How long a claimed RUNNING job may run without a heartbeat. */
export const LEASE_DURATION_MS = 2 * 60 * 1000;
/** Worker refreshes leaseExpiresAt on this interval while the executor runs. */
export const HEARTBEAT_INTERVAL_MS = 15 * 1000;
export const LEASE_TIMEOUT_MESSAGE = "测速任务租约超时，已停止。";
