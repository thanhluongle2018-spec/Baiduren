import http from "node:http";
import { REQUEST_TIMEOUT_MS } from "@/lib/proxy-runtime/constants";
import { ProxyRuntimeError } from "@/lib/proxy-runtime/errors";
import { VIA_HEADER } from "@/lib/proxy-runtime/fake-runtime";
import { isLocalhost } from "@/lib/proxy-runtime/ports";
import type { ConnectivityProbeResult, ProxyEndpoint } from "@/lib/proxy-runtime/types";

function parseTarget(targetUrl: string) {
  let url: URL;
  try {
    url = new URL(targetUrl);
  } catch {
    throw new ProxyRuntimeError("PROBE_TARGET_INVALID");
  }
  if (url.protocol !== "http:") {
    throw new ProxyRuntimeError("PROBE_TARGET_INVALID");
  }
  if (url.username || url.password) {
    throw new ProxyRuntimeError("PROBE_TARGET_INVALID");
  }
  if (!isLocalhost(url.hostname)) {
    throw new ProxyRuntimeError("PROBE_TARGET_INVALID");
  }
  return url;
}

/**
 * HTTP connectivity check through a localhost HTTP proxy.
 * Target must be http://127.0.0.1 (or localhost) — no remote fetch in this phase.
 * Latency is probe RTT only, not ranking latency.
 */
export async function probeViaProxy(options: {
  endpoint: ProxyEndpoint;
  targetUrl: string;
  expectedVia?: string;
  timeoutMs?: number;
}): Promise<ConnectivityProbeResult> {
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const started = Date.now();

  try {
    const target = parseTarget(options.targetUrl);
    if (options.endpoint.host !== "127.0.0.1") {
      throw new ProxyRuntimeError("PROBE_TARGET_INVALID");
    }
    const { statusCode, body } = await absoluteFormGet({
      proxy: options.endpoint,
      target,
      timeoutMs,
    });
    const latencyMs = Date.now() - started;
    let viaToken: string | null = null;
    try {
      const parsed = JSON.parse(body) as { via?: unknown };
      if (typeof parsed.via === "string") viaToken = parsed.via;
    } catch {
      viaToken = null;
    }
    const viaProxy =
      viaToken != null &&
      (options.expectedVia == null || viaToken === options.expectedVia);
    if (statusCode >= 200 && statusCode < 300) {
      return {
        success: true,
        latencyMs,
        errorCode: null,
        sanitizedError: null,
        viaProxy,
        viaToken,
        statusCode,
      };
    }
    return {
      success: false,
      latencyMs,
      errorCode: "PROBE_FAILED",
      sanitizedError: "连通性验证失败。",
      viaProxy: false,
      viaToken,
      statusCode,
    };
  } catch (error) {
    const latencyMs = Date.now() - started;
    const code =
      error instanceof ProxyRuntimeError ? error.code : "PROBE_FAILED";
    const message =
      error instanceof ProxyRuntimeError ? error.message : "连通性验证失败。";
    return {
      success: false,
      latencyMs,
      errorCode: code,
      sanitizedError: message,
      viaProxy: false,
      viaToken: null,
      statusCode: null,
    };
  }
}

function absoluteFormGet(input: {
  proxy: ProxyEndpoint;
  target: URL;
  timeoutMs: number;
}) {
  return new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
    const req = http.request(
      {
        host: input.proxy.host,
        port: input.proxy.port,
        method: "GET",
        path: input.target.href,
        headers: {
          Host: input.target.host,
          Connection: "close",
        },
        timeout: input.timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk as Buffer));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new ProxyRuntimeError("PROBE_TIMEOUT"));
    });
    req.on("error", () => reject(new ProxyRuntimeError("PROBE_FAILED")));
    req.end();
  });
}

export { VIA_HEADER };
