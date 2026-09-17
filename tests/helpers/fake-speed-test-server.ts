import http from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { LOCALHOST } from "@/lib/proxy-runtime/constants";
import { VIA_HEADER } from "@/lib/proxy-runtime/fake-runtime";

export const FAKE_DIRECT_IP = "198.51.100.20";
export const FAKE_PROXIED_IP = "203.0.113.10";
export const FAKE_SERVER_ID = "fake-speed-test-server";

const MAX_DOWNLOAD = 64 * 1024 * 1024;
const ZERO = Buffer.alloc(64 * 1024);

export type FakeSpeedTestServerOptions = {
  delayMs?: number;
  pingDelayMs?: number;
  downloadDelayMs?: number;
  uploadDelayMs?: number;
  failDownloadNth?: number;
  failPingNth?: number;
  failUploadNth?: number;
};

export type FakeWhoami = {
  isDemo: true;
  fixture: true;
  serverId: string;
  observedSourceIp: string;
  path: "direct" | "proxied-fixture";
  via: string | null;
};

/**
 * Localhost-only fixture. Not a real SpeedTestServer and not a real exit IP.
 */
export class FakeSpeedTestServer {
  readonly isDemo = true as const;
  private server: http.Server | null = null;
  private port: number | null = null;
  private downloadCount = 0;
  private pingCount = 0;
  private uploadCount = 0;
  private uploadBytes = 0;
  private readonly options: FakeSpeedTestServerOptions;

  constructor(options: FakeSpeedTestServerOptions = {}) {
    this.options = options;
  }

  get address() {
    if (this.port == null) return null;
    return `http://${LOCALHOST}:${this.port}`;
  }

  get portNumber() {
    return this.port;
  }

  bytesDiscarded() {
    return this.uploadBytes;
  }

  async start() {
    if (this.server) return this.address as string;
    const server = http.createServer((req, res) => {
      void this.handle(req, res);
    });
    this.server = server;
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        this.server = null;
        this.port = null;
        reject(error);
      };
      server.once("error", onError);
      server.listen(0, LOCALHOST, () => {
        server.off("error", onError);
        resolve();
      });
    });
    const addr = server.address();
    this.port = typeof addr === "object" && addr ? addr.port : 0;
    return this.address as string;
  }

  async stop() {
    const server = this.server;
    this.server = null;
    this.port = null;
    if (!server) return;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections?.();
    });
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      const url = new URL(req.url ?? "/", `http://${LOCALHOST}`);
      const delay =
        url.searchParams.get("delay") != null
          ? Number(url.searchParams.get("delay"))
          : this.delayFor(url.pathname);
      if (Number.isFinite(delay) && delay > 0) await sleep(delay);
      if (res.writableEnded) return;

      const failQuery = url.searchParams.get("fail") === "1";

      if (url.pathname === "/health") {
        json(res, 200, {
          ok: true,
          isDemo: true,
          region: "fixture",
          version: "3b3-a-fake",
        });
        return;
      }

      if (url.pathname === "/speedtest/ping") {
        this.pingCount += 1;
        if (failQuery || this.options.failPingNth === this.pingCount) {
          json(res, 500, { isDemo: true, error: "SERVER_ERROR" });
          return;
        }
        json(res, 200, this.whoamiBody(req));
        return;
      }

      if (url.pathname === "/speedtest/whoami") {
        json(res, 200, this.whoamiBody(req));
        return;
      }

      if (url.pathname === "/speedtest/download" && req.method === "GET") {
        this.downloadCount += 1;
        if (failQuery || this.options.failDownloadNth === this.downloadCount) {
          json(res, 500, { isDemo: true, error: "SERVER_ERROR" });
          return;
        }
        const requested = Number(url.searchParams.get("size") ?? 1024);
        const size = Number.isFinite(requested)
          ? Math.min(Math.max(0, Math.floor(requested)), MAX_DOWNLOAD)
          : 0;
        await streamZeros(res, size);
        return;
      }

      if (url.pathname === "/speedtest/upload" && req.method === "POST") {
        this.uploadCount += 1;
        const accepted = await discardBody(req);
        this.uploadBytes += accepted;
        if (failQuery || this.options.failUploadNth === this.uploadCount) {
          json(res, 500, { isDemo: true, error: "SERVER_ERROR", bytes: 0 });
          return;
        }
        json(res, 200, { isDemo: true, bytes: accepted });
        return;
      }

      json(res, 404, { isDemo: true, error: "not_found" });
    } catch {
      if (!res.headersSent) {
        json(res, 500, { isDemo: true, error: "SERVER_ERROR" });
      } else if (!res.writableEnded) {
        res.end();
      }
    }
  }

  private delayFor(pathname: string) {
    if (pathname === "/speedtest/ping") return this.options.pingDelayMs ?? this.options.delayMs ?? 0;
    if (pathname === "/speedtest/download") {
      return this.options.downloadDelayMs ?? this.options.delayMs ?? 0;
    }
    if (pathname === "/speedtest/upload") {
      return this.options.uploadDelayMs ?? this.options.delayMs ?? 0;
    }
    return this.options.delayMs ?? 0;
  }

  private whoamiBody(req: http.IncomingMessage): FakeWhoami {
    const header = req.headers[VIA_HEADER];
    const via = Array.isArray(header) ? header[0] : header ?? null;
    const proxied = typeof via === "string" && via.length > 0;
    return {
      isDemo: true,
      fixture: true,
      serverId: FAKE_SERVER_ID,
      observedSourceIp: proxied ? FAKE_PROXIED_IP : FAKE_DIRECT_IP,
      path: proxied ? "proxied-fixture" : "direct",
      via: proxied ? via : null,
    };
  }
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  const payload = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    "content-length": payload.length,
  });
  res.end(payload);
}

async function streamZeros(res: http.ServerResponse, size: number) {
  res.writeHead(200, {
    "content-type": "application/octet-stream",
    "cache-control": "no-store",
    "content-length": size,
  });
  let remaining = size;
  const src = new Readable({
    read() {
      if (remaining <= 0) {
        this.push(null);
        return;
      }
      const n = Math.min(remaining, ZERO.length);
      remaining -= n;
      this.push(n === ZERO.length ? ZERO : ZERO.subarray(0, n));
    },
  });
  try {
    await pipeline(src, res);
  } catch {
    src.destroy();
  }
}

function discardBody(req: http.IncomingMessage) {
  return new Promise<number>((resolve, reject) => {
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
    });
    req.on("end", () => resolve(total));
    req.on("error", reject);
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
