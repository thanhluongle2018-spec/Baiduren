import type { SpeedTestStatus } from "@/types";
import { SpeedTestJobError } from "@/lib/speedtest/errors";

const ALLOWED_TRANSITIONS: Record<SpeedTestStatus, SpeedTestStatus[]> = {
  PENDING: ["RUNNING", "CANCELLED"],
  QUEUED: ["PENDING", "RUNNING", "CANCELLED"],
  RUNNING: ["SUCCESS", "FAILED", "CANCELLED"],
  SUCCESS: [],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export function isSuccessfulStatus(status: SpeedTestStatus) {
  return status === "SUCCESS" || status === "COMPLETED";
}

export function isTerminalStatus(status: SpeedTestStatus) {
  return (
    status === "SUCCESS" ||
    status === "COMPLETED" ||
    status === "FAILED" ||
    status === "CANCELLED"
  );
}

export function canTransition(
  from: SpeedTestStatus,
  to: SpeedTestStatus
): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: SpeedTestStatus, to: SpeedTestStatus) {
  if (!canTransition(from, to)) {
    throw new SpeedTestJobError(
      "ILLEGAL_TRANSITION",
      `不允许从 ${from} 跳转到 ${to}。`
    );
  }
}

export function allowedTargets(from: SpeedTestStatus) {
  return [...ALLOWED_TRANSITIONS[from]];
}
