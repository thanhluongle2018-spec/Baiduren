export type SpeedTestErrorCode =
  | "AIRPORT_NOT_FOUND"
  | "NODE_NOT_FOUND"
  | "NODE_AIRPORT_MISMATCH"
  | "SERVER_NOT_FOUND"
  | "SERVER_DISABLED"
  | "INVALID_CONCURRENCY"
  | "JOB_NOT_FOUND"
  | "ILLEGAL_TRANSITION"
  | "DATABASE_UNAVAILABLE"
  | "DEMO_ONLY";

const STATUS_BY_CODE: Record<SpeedTestErrorCode, number> = {
  AIRPORT_NOT_FOUND: 404,
  NODE_NOT_FOUND: 404,
  NODE_AIRPORT_MISMATCH: 400,
  SERVER_NOT_FOUND: 404,
  SERVER_DISABLED: 409,
  INVALID_CONCURRENCY: 400,
  JOB_NOT_FOUND: 404,
  ILLEGAL_TRANSITION: 409,
  DATABASE_UNAVAILABLE: 503,
  DEMO_ONLY: 400,
};

const MESSAGE_BY_CODE: Record<SpeedTestErrorCode, string> = {
  AIRPORT_NOT_FOUND: "机场不存在。",
  NODE_NOT_FOUND: "节点不存在。",
  NODE_AIRPORT_MISMATCH: "节点不属于该机场。",
  SERVER_NOT_FOUND: "测速服务器不存在。",
  SERVER_DISABLED: "测速服务器已停用，无法创建或执行任务。",
  INVALID_CONCURRENCY: "concurrency 必须是 1 到 8 的整数。",
  JOB_NOT_FOUND: "测速任务不存在。",
  ILLEGAL_TRANSITION: "不允许的测速任务状态跳转。",
  DATABASE_UNAVAILABLE: "数据库暂时不可用。",
  DEMO_ONLY: "当前阶段仅允许创建演示测速任务。",
};

export class SpeedTestJobError extends Error {
  readonly code: SpeedTestErrorCode;
  readonly status: number;

  constructor(code: SpeedTestErrorCode, message = MESSAGE_BY_CODE[code]) {
    super(message);
    this.name = "SpeedTestJobError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}

export function isSpeedTestJobError(error: unknown): error is SpeedTestJobError {
  return error instanceof SpeedTestJobError;
}

export function storedExecutorErrorMessage(error: unknown) {
  if (isSpeedTestJobError(error)) return error.message;
  if (error instanceof Error && error.name) {
    return `模拟测速执行失败（${error.name}）。`;
  }
  return "模拟测速执行失败。";
}
