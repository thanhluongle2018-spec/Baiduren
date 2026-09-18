import http from "node:http";
import { isLocalhost } from "@/lib/proxy-runtime/ports";
import type { ProxyEndpoint } from "@/lib/proxy-runtime/types";
import { SpeedTestEngineError } from "@/lib/speedtest/engine-error";
import type { EngineErrorCode } from "@/lib/speedtest/metrics";

export type LocalhostHttpResult = {
  ok: boolean;
  statusCode: number | null;
  bytes: number;
  durationMs: number;
  timedOut: boolean;
  body: Buffer;
  errorCode: EngineErrorCode | null;
};

function assertLocalhostTarget(targetUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw new SpeedTestEngineError("PROBE_TARGET_INVALID");
  }
  if (parsed.protocol !== "http:") {
    throw new SpeedTestEngineError("PROBE_TARGET_INVALID");
  }
  if (!isLocalhost(parsed.hostname)) {
    throw new SpeedTestEngineError("PROBE_TARGET_INVALID");
  }
  return parsed;
}

export async function localhostDirectGet(
  targetUrl: string,
  timeoutMs: number
): Promise<LocalhostHttpResult> {
  const target = assertLocalhostTarget(targetUrl);
  const started = Date.now();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (
      statusCode: number | null,
      body: Buffer,
      errorCode: EngineErrorCode | null
    ) => {
      if (settled) return;
      settled = true;
      resolve({
        ok: errorCode == null && statusCode != null && statusCode < 400,
        statusCode,
        bytes: body.length,
        durationMs: Math.max(1, Date.now() - started),
        timedOut: errorCode === "TARGET_TIMEOUT",
        body,
        errorCode,
      });
    };
    const req = http.get(target.href, { timeout: timeoutMs }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk as Buffer));
      res.on("end", () =>
        finish(res.statusCode ?? 0, Buffer.concat(chunks), null)
      );
      res.on("error", () => finish(res.statusCode ?? 0, Buffer.concat(chunks), "SERVER_ERROR"));
    });
    req.on("timeout", () => {
      finish(null, Buffer.alloc(0), "TARGET_TIMEOUT");
      req.destroy();
    });
    req.on("error", () => {
      if (settled) return;
      finish(null, Buffer.alloc(0), "PROXY_CONNECT_FAILED");
    });
  });
}

export function localhostViaProxy(options: {
  proxy: ProxyEndpoint;
  targetUrl: string;
  method?: "GET" | "POST";
  body?: Buffer;
  timeoutMs: number;
  timeoutCode?: EngineErrorCode;
}): Promise<LocalhostHttpResult> {
  const target = assertLocalhostTarget(options.targetUrl);
  if (!isLocalhost(options.proxy.host)) {
    throw new SpeedTestEngineError("PROBE_TARGET_INVALID");
  }
  const method = options.method ?? "GET";
  const timeoutCode = options.timeoutCode ?? "TARGET_TIMEOUT";
  const started = Date.now();

  return new Promise((resolve) => {
    let settled = false;
    const headers: http.OutgoingHttpHeaders = {
      Host: target.host,
      Connection: "close",
    };
    if (method === "POST") {
      headers["content-length"] = options.body?.length ?? 0;
    }

    const finish = (
      statusCode: number | null,
      body: Buffer,
      errorCode: EngineErrorCode | null
    ) => {
      if (settled) return;
      settled = true;
      const httpError = statusCode != null && statusCode >= 400;
      resolve({
        ok: errorCode == null && !httpError && statusCode != null && statusCode < 400,
        statusCode,
        bytes: body.length,
        durationMs: Math.max(1, Date.now() - started),
        timedOut: errorCode === timeoutCode,
        body,
        errorCode: errorCode ?? (httpError ? "TARGET_HTTP_ERROR" : null),
      });
    };

    const req = http.request(
      {
        host: options.proxy.host,
        port: options.proxy.port,
        method,
        path: target.href,
        headers,
        timeout: options.timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => finish(res.statusCode ?? 0, Buffer.concat(chunks), null));
        res.on("error", () => finish(res.statusCode ?? 0, Buffer.concat(chunks), "SERVER_ERROR"));
      }
    );

    req.on("timeout", () => {
      finish(null, Buffer.alloc(0), timeoutCode);
      req.destroy();
    });
    req.on("error", () => {
      if (settled) return;
      finish(null, Buffer.alloc(0), timeoutCode === "TARGET_TIMEOUT" ? "PROXY_CONNECT_FAILED" : timeoutCode);
    });

    if (method === "POST" && options.body) req.write(options.body);
    req.end();
  });
}
