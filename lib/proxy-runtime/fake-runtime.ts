import http from "node:http";
import net from "node:net";
import { randomUUID } from "node:crypto";
import { LOCALHOST, STARTUP_TIMEOUT_MS } from "@/lib/proxy-runtime/constants";
import { ProxyRuntimeError } from "@/lib/proxy-runtime/errors";
import { assertRuntimeTransition } from "@/lib/proxy-runtime/lifecycle";
import { isLocalhost } from "@/lib/proxy-runtime/ports";
import type {
  ProxyEndpoint,
  ProxyRuntime,
  ProxyRuntimeState,
} from "@/lib/proxy-runtime/types";

export const VIA_HEADER = "x-baiduren-via";

export type FakeProxyRuntimeOptions = {
  failStart?: boolean;
  startupDelayMs?: number;
  crashAfterMs?: number;
  hangOnStart?: boolean;
  healthCheckDelayMs?: number;
  startupTimeoutMs?: number;
};

function endpoint(port: number): ProxyEndpoint {
  return {
    host: LOCALHOST,
    port,
    scheme: "http",
    url: `http://${LOCALHOST}:${port}`,
  };
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new ProxyRuntimeError("STARTUP_TIMEOUT"));
    });
  });
}

/**
 * Test/fixture runtime. Speaks HTTP proxy (absolute-form + CONNECT) on
 * 127.0.0.1 only. It is not a real SS/VMess/VLESS/Trojan client.
 */
export class FakeProxyRuntime implements ProxyRuntime {
  readonly kind = "fake" as const;
  readonly id = randomUUID();
  private current: ProxyRuntimeState = "CREATED";
  private server: http.Server | null = null;
  private port: number | null = null;
  private crashTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly options: FakeProxyRuntimeOptions;

  constructor(options: FakeProxyRuntimeOptions = {}) {
    this.options = options;
  }

  state() {
    return this.current;
  }

  getProxyEndpoint() {
    if (this.current !== "RUNNING" || this.port == null) return null;
    return endpoint(this.port);
  }

  async start() {
    assertRuntimeTransition(this.current, "STARTING");
    this.current = "STARTING";
    const timeoutMs = this.options.startupTimeoutMs ?? STARTUP_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (this.options.failStart) {
        throw new ProxyRuntimeError("PROCESS_CRASH");
      }
      if (this.options.hangOnStart) {
        await sleep(timeoutMs + 50, controller.signal);
      }
      if (this.options.startupDelayMs) {
        await sleep(this.options.startupDelayMs, controller.signal);
      }

      const server = this.createServer();
      this.server = server;
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, LOCALHOST, () => resolve());
      });
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      if (!port) throw new ProxyRuntimeError("PORT_UNAVAILABLE");
      this.port = port;

      assertRuntimeTransition(this.current, "RUNNING");
      this.current = "RUNNING";

      if (this.options.crashAfterMs != null) {
        this.crashTimer = setTimeout(() => {
          void this.crash();
        }, this.options.crashAfterMs);
      }

      return endpoint(port);
    } catch (error) {
      await this.failAndCleanup();
      if (error instanceof ProxyRuntimeError) throw error;
      if (controller.signal.aborted) {
        throw new ProxyRuntimeError("STARTUP_TIMEOUT");
      }
      throw new ProxyRuntimeError("PROCESS_CRASH");
    } finally {
      clearTimeout(timer);
    }
  }

  async stop() {
    if (this.current === "STOPPED") return;
    if (this.current === "CREATED") {
      this.current = "STOPPED";
      return;
    }
    if (this.current !== "FAILED") {
      assertRuntimeTransition(this.current, "STOPPING");
      this.current = "STOPPING";
    }
    await this.cleanup();
    this.current = "STOPPED";
  }

  async healthCheck() {
    if (this.options.healthCheckDelayMs) {
      await sleep(this.options.healthCheckDelayMs);
    }
    if (this.current !== "RUNNING" || this.port == null) return false;
    return new Promise<boolean>((resolve) => {
      const socket = net.connect({ host: LOCALHOST, port: this.port! });
      const timer = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, 500);
      socket.once("connect", () => {
        clearTimeout(timer);
        socket.end();
        resolve(true);
      });
      socket.once("error", () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(false);
      });
    });
  }

  private async crash() {
    if (this.current !== "RUNNING") return;
    this.current = "FAILED";
    await this.cleanup();
    this.current = "STOPPED";
  }

  private async failAndCleanup() {
    if (this.current === "STARTING" || this.current === "RUNNING") {
      this.current = "FAILED";
    }
    await this.cleanup();
    this.current = "STOPPED";
  }

  private async cleanup() {
    if (this.crashTimer) {
      clearTimeout(this.crashTimer);
      this.crashTimer = null;
    }
    const server = this.server;
    this.server = null;
    this.port = null;
    if (!server) return;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections?.();
    });
  }

  private createServer() {
    const via = this.id;
    const server = http.createServer((req, res) => {
      try {
        const target = new URL(req.url ?? "", `http://${LOCALHOST}`);
        if (!isLocalhost(target.hostname)) {
          res.writeHead(403).end();
          return;
        }
        const headers = { ...req.headers, [VIA_HEADER]: via, host: target.host };
        const upstream = http.request(
          {
            hostname: target.hostname,
            port: target.port || 80,
            path: `${target.pathname}${target.search}`,
            method: req.method,
            headers,
          },
          (up) => {
            res.writeHead(up.statusCode ?? 502, up.headers);
            up.pipe(res);
          }
        );
        upstream.on("error", () => {
          if (!res.headersSent) res.writeHead(502);
          res.end();
        });
        req.pipe(upstream);
      } catch {
        res.writeHead(400).end();
      }
    });

    server.on("connect", (req, clientSocket) => {
      const [host, portText] = (req.url ?? "").split(":");
      const port = Number(portText);
      if (!isLocalhost(host) || !Number.isInteger(port)) {
        clientSocket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
        return;
      }
      const upstream = net.connect(port, host, () => {
        clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        clientSocket.pipe(upstream);
        upstream.pipe(clientSocket);
      });
      upstream.on("error", () => clientSocket.destroy());
      clientSocket.on("error", () => upstream.destroy());
    });

    return server;
  }
}
