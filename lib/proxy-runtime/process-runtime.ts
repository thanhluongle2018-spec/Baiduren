import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveMihomoBinary } from "@/lib/proxy-runtime/binary";
import {
  assertLocalhostOnlyConfig,
  buildMihomoConfig,
} from "@/lib/proxy-runtime/config-mihomo";
import {
  LOCALHOST,
  SHUTDOWN_TIMEOUT_MS,
  STARTUP_TIMEOUT_MS,
} from "@/lib/proxy-runtime/constants";
import { ProxyRuntimeError } from "@/lib/proxy-runtime/errors";
import { assertRuntimeTransition } from "@/lib/proxy-runtime/lifecycle";
import { allocateLocalhostPort, tcpHealthy } from "@/lib/proxy-runtime/ports";
import type {
  ProxyEndpoint,
  ProxyRuntime,
  ProxyRuntimeState,
  RuntimeNodeInput,
} from "@/lib/proxy-runtime/types";

export type MihomoProcessRuntimeOptions = {
  node: RuntimeNodeInput;
  binaryPath?: string | null;
  extraEnv?: Record<string, string | undefined>;
  startupTimeoutMs?: number;
  shutdownTimeoutMs?: number;
};

function endpoint(port: number): ProxyEndpoint {
  return {
    host: LOCALHOST,
    port,
    scheme: "http",
    url: `http://${LOCALHOST}:${port}`,
  };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MihomoProcessRuntime implements ProxyRuntime {
  readonly kind = "mihomo" as const;
  readonly id = randomUUID();
  private current: ProxyRuntimeState = "CREATED";
  private child: ChildProcess | null = null;
  private workDir: string | null = null;
  private mixedPort: number | null = null;
  private exitCode: number | null = null;
  private readonly options: MihomoProcessRuntimeOptions;

  constructor(options: MihomoProcessRuntimeOptions) {
    this.options = options;
  }

  state() {
    return this.current;
  }

  getProxyEndpoint() {
    if (this.current !== "RUNNING" || this.mixedPort == null) return null;
    return endpoint(this.mixedPort);
  }

  workDirectory() {
    return this.workDir;
  }

  async start() {
    assertRuntimeTransition(this.current, "STARTING");
    this.current = "STARTING";
    try {
      const binary = resolveMihomoBinary(this.options.binaryPath);
      if (!binary) throw new ProxyRuntimeError("BINARY_NOT_FOUND");

      const mixedPort = await allocateLocalhostPort();
      const controllerPort = await allocateLocalhostPort();
      const secret = randomBytes(16).toString("hex");
      const yamlText = buildMihomoConfig(this.options.node, {
        mixedPort,
        controllerPort,
        secret,
      });
      assertLocalhostOnlyConfig(yamlText);

      const workDir = await mkdtemp(path.join(tmpdir(), "baiduren-runtime-"));
      this.workDir = workDir;
      await chmod(workDir, 0o700);
      const configPath = path.join(workDir, "config.yaml");
      await writeFile(configPath, yamlText, { encoding: "utf8", mode: 0o600 });
      await chmod(configPath, 0o600);

      const child = spawn(binary, ["-d", workDir, "-f", configPath], {
        cwd: workDir,
        env: { ...process.env, ...this.options.extraEnv },
        stdio: ["ignore", "pipe", "pipe"],
      });
      this.child = child;
      this.mixedPort = mixedPort;
      child.stdout?.resume();
      child.stderr?.resume();
      child.on("error", () => {
        this.exitCode = -1;
        if (this.current === "RUNNING" || this.current === "STARTING") {
          this.current = "FAILED";
        }
      });
      child.on("exit", (code) => {
        this.exitCode = code;
        if (this.current === "RUNNING" || this.current === "STARTING") {
          this.current = "FAILED";
        }
      });

      const timeoutMs = this.options.startupTimeoutMs ?? STARTUP_TIMEOUT_MS;
      const startedAt = Date.now();
      while (Date.now() - startedAt < timeoutMs) {
        if (this.exitCode != null) {
          throw new ProxyRuntimeError("PROCESS_CRASH");
        }
        if (await tcpHealthy(LOCALHOST, mixedPort, 150)) {
          if (this.exitCode != null) {
            throw new ProxyRuntimeError("PROCESS_CRASH");
          }
          this.current = "RUNNING";
          return endpoint(mixedPort);
        }
        await wait(40);
      }
      throw new ProxyRuntimeError("STARTUP_TIMEOUT");
    } catch (error) {
      await this.failAndCleanup();
      if (error instanceof ProxyRuntimeError) throw error;
      throw new ProxyRuntimeError("PROCESS_CRASH");
    }
  }

  async stop() {
    if (this.current === "STOPPED") return;
    if (this.current === "CREATED") {
      this.current = "STOPPED";
      return;
    }
    if (this.current !== "FAILED") {
      if (this.current !== "STOPPING") {
        assertRuntimeTransition(this.current, "STOPPING");
        this.current = "STOPPING";
      }
    }
    await this.cleanup();
    this.current = "STOPPED";
  }

  async healthCheck() {
    if (this.current !== "RUNNING" || this.mixedPort == null) return false;
    if (this.exitCode != null) return false;
    return tcpHealthy(LOCALHOST, this.mixedPort, 400);
  }

  private async failAndCleanup() {
    if (this.current === "STARTING" || this.current === "RUNNING") {
      this.current = "FAILED";
    }
    await this.cleanup();
    this.current = "STOPPED";
  }

  private async cleanup() {
    const child = this.child;
    this.child = null;
    if (child && child.exitCode == null && !child.killed) {
      const timeout = this.options.shutdownTimeoutMs ?? SHUTDOWN_TIMEOUT_MS;
      await killChild(child, timeout);
    }
    const dir = this.workDir;
    this.workDir = null;
    this.mixedPort = null;
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

async function killChild(child: ChildProcess, timeoutMs: number) {
  await new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      resolve();
    };
    if (child.exitCode != null) {
      finish();
      return;
    }
    child.once("exit", finish);
    child.kill("SIGTERM");
    const timer = setTimeout(() => {
      if (child.exitCode == null) child.kill("SIGKILL");
    }, timeoutMs);
  });
  await wait(20);
}
