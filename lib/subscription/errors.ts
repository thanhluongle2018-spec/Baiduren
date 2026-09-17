import { redactSecrets } from "@/lib/subscription/secrets";

export type SubscriptionErrorCode =
  | "AIRPORT_NOT_FOUND"
  | "CONTENT_REQUIRED"
  | "CONTENT_TOO_LARGE"
  | "INVALID_YAML"
  | "DATABASE_UNAVAILABLE";

const STATUS_BY_CODE: Record<SubscriptionErrorCode, number> = {
  AIRPORT_NOT_FOUND: 404,
  CONTENT_REQUIRED: 400,
  CONTENT_TOO_LARGE: 413,
  INVALID_YAML: 400,
  DATABASE_UNAVAILABLE: 503,
};

const MESSAGE_BY_CODE: Record<SubscriptionErrorCode, string> = {
  AIRPORT_NOT_FOUND: "机场不存在。",
  CONTENT_REQUIRED: "请提供订阅内容。",
  CONTENT_TOO_LARGE: "订阅内容过大。",
  INVALID_YAML: "订阅 YAML 无法解析。",
  DATABASE_UNAVAILABLE: "数据库暂时不可用。",
};

export class SubscriptionError extends Error {
  readonly code: SubscriptionErrorCode;
  readonly status: number;

  constructor(code: SubscriptionErrorCode, message = MESSAGE_BY_CODE[code]) {
    super(redactSecrets(message));
    this.name = "SubscriptionError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}

export function isSubscriptionError(error: unknown): error is SubscriptionError {
  return error instanceof SubscriptionError;
}
