import http from "node:http";
import type { EngineErrorCode } from "../../lib/speedtest/metrics";
import type { ProxyEndpoint } from "../../lib/proxy-runtime/types";

export type ViaProxyResult = {
  ok: boolean;
  isDemo: true;
  statusCode: number | null;
  bytes: number;
  durationMs: number;
  timedOut: boolean;
  truncated: boolean;
  body: Buffer;
  errorCode: EngineErrorCode | null;
};

/**
 * HTTP client that speaks absolute-form through FakeProxyRuntime.
 * Fixture-only: results are always isDemo=true.
 */
export function requestViaHttpProxy(options: {
  proxy: ProxyEndpoint;
  targetUrl: string;
  method?: "GET" | "POST";
  body?: Buffer;
  capBytes?: number;
  timeoutMs: number;
  timeoutCode?: EngineErrorCode;
}): Promise<ViaProxyResult> {
  const target = new URL(options.targetUrl);
  const method = options.method ?? "GET";
  const cap = options.capBytes ?? Number.POSITIVE_INFINITY;
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
        let bytes = 0;

        res.on("data", (chunk: Buffer) => {
          if (settled) return;
          const next = bytes + chunk.length;
          if (next >= cap) {
            const take = Math.max(0, cap - bytes);
            if (take > 0) chunks.push(chunk.subarray(0, take));
            bytes = cap;
            finish(res.statusCode ?? 0, bytes, next > cap, Buffer.concat(chunks));
            req.destroy();
            return;
          }
          bytes = next;
          chunks.push(chunk);
        });
        res.on("end", () => {
          if (settled) return;
          finish(res.statusCode ?? 0, bytes, false, Buffer.concat(chunks));
        });
        res.on("error", () => {
          if (settled) return;
          finish(res.statusCode ?? 0, bytes, false, Buffer.concat(chunks), "SERVER_ERROR");
        });
      }
    );

    const finish = (
      statusCode: number | null,
      bytes: number,
      truncated: boolean,
      body: Buffer,
      errorCode: EngineErrorCode | null = null
    ) => {
      if (settled) return;
      settled = true;
      const durationMs = Math.max(1, Date.now() - started);
      const timedOut = errorCode === timeoutCode;
      const httpError = statusCode != null && statusCode >= 400;
      let classified: EngineErrorCode | null = errorCode;
      if (classified == null && httpError) classified = "TARGET_HTTP_ERROR";
      if (classified == null && truncated) classified = "BYTE_CAP_REACHED";
      resolve({
        ok: !timedOut && !httpError && classified !== "PROXY_CONNECT_FAILED" && classified !== "SERVER_ERROR",
        isDemo: true,
        statusCode,
        bytes,
        durationMs,
        timedOut,
        truncated,
        body,
        errorCode: classified,
      });
    };

    req.on("timeout", () => {
      finish(null, 0, false, Buffer.alloc(0), timeoutCode);
      req.destroy();
    });
    req.on("error", () => {
      if (settled) return;
      const durationMs = Date.now() - started;
      if (durationMs >= options.timeoutMs - 5) {
        finish(null, 0, false, Buffer.alloc(0), timeoutCode);
        return;
      }
      finish(null, 0, false, Buffer.alloc(0), "PROXY_CONNECT_FAILED");
    });

    if (method === "POST" && options.body) req.write(options.body);
    req.end();
  });
}

export function directGet(
  url: string,
  timeoutMs = 2000,
  extraHeaders?: http.OutgoingHttpHeaders
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs, headers: extraHeaders }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk as Buffer));
      res.on("end", () =>
        resolve({
          statusCode: res.statusCode ?? 0,
          body: Buffer.concat(chunks).toString("utf8"),
        })
      );
    });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("TARGET_TIMEOUT"));
    });
    req.on("error", reject);
  });
}

export function parseJsonBody<T>(body: Buffer | string): T {
  const text = typeof body === "string" ? body : body.toString("utf8");
  return JSON.parse(text) as T;
}
