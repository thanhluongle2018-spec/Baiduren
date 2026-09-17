import { redactSecrets } from "@/lib/subscription/secrets";

export type ProxyRuntimeErrorCode =
  | "UNSUPPORTED_PROTOCOL"
  | "INVALID_NODE"
  | "BINARY_NOT_FOUND"
  | "STARTUP_TIMEOUT"
  | "HEALTHCHECK_TIMEOUT"
  | "PROCESS_CRASH"
  | "PROBE_TIMEOUT"
  | "PROBE_FAILED"
  | "PROBE_TARGET_INVALID"
  | "NOT_RUNNING"
  | "PORT_UNAVAILABLE"
  | "CLEANUP_FAILED";

const MESSAGE_BY_CODE: Record<ProxyRuntimeErrorCode, string> = {
  UNSUPPORTED_PROTOCOL: "当前 Runtime 不支持该协议。",
  INVALID_NODE: "节点配置不完整，无法启动 Runtime。",
  BINARY_NOT_FOUND: "未找到 Mihomo 可执行文件。",
  STARTUP_TIMEOUT: "代理运行时启动超时。",
  HEALTHCHECK_TIMEOUT: "代理运行时健康检查超时。",
  PROCESS_CRASH: "代理运行时进程异常退出。",
  PROBE_TIMEOUT: "连通性验证超时。",
  PROBE_FAILED: "连通性验证失败。",
  PROBE_TARGET_INVALID: "连通性验证目标不合法。",
  NOT_RUNNING: "代理运行时未在运行。",
  PORT_UNAVAILABLE: "无法分配 localhost 端口。",
  CLEANUP_FAILED: "代理运行时清理失败。",
};

export class ProxyRuntimeError extends Error {
  readonly code: ProxyRuntimeErrorCode;

  constructor(code: ProxyRuntimeErrorCode, message = MESSAGE_BY_CODE[code]) {
    super(redactSecrets(message));
    this.name = "ProxyRuntimeError";
    this.code = code;
  }
}

export function isProxyRuntimeError(error: unknown): error is ProxyRuntimeError {
  return error instanceof ProxyRuntimeError;
}

export function sanitizedRuntimeError(error: unknown) {
  if (isProxyRuntimeError(error)) return error.message;
  return "代理运行时失败。";
}
