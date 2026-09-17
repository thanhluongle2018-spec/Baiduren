import assert from "node:assert/strict";
import { chmod } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { FakeProxyRuntime } from "../lib/proxy-runtime/fake-runtime";
import { healthCheckWithTimeout } from "../lib/proxy-runtime/health";
import { MihomoProcessRuntime } from "../lib/proxy-runtime/process-runtime";
import { ProxyRuntimeError } from "../lib/proxy-runtime/errors";
import type { ProxyRuntime, RuntimeNodeInput } from "../lib/proxy-runtime/types";

const stubPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "helpers",
  "stub-mihomo.mjs"
);

const ssNode: RuntimeNodeInput = {
  name: "香港 01",
  protocol: "ss",
  server: "hk.example.invalid",
  port: 8388,
  rawConfig: {
    type: "ss",
    cipher: "aes-256-gcm",
    password: "fake-ss-password-9f3c",
    server: "hk.example.invalid",
    port: 8388,
  },
};

const runtimes: ProxyRuntime[] = [];

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.stop()));
});

function track<T extends ProxyRuntime>(runtime: T) {
  runtimes.push(runtime);
  return runtime;
}

async function listenOn(port: number) {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

test("Fake Runtime start success and health check", async () => {
  const runtime = track(new FakeProxyRuntime());
  assert.equal(runtime.state(), "CREATED");
  const endpoint = await runtime.start();
  assert.equal(runtime.state(), "RUNNING");
  assert.equal(endpoint.host, "127.0.0.1");
  assert.equal(endpoint.scheme, "http");
  assert.equal(await runtime.healthCheck(), true);
  assert.deepEqual(runtime.getProxyEndpoint(), endpoint);
});

test("Fake Runtime start failure 进入 FAILED 后 STOPPED", async () => {
  const runtime = track(new FakeProxyRuntime({ failStart: true }));
  await assert.rejects(
    () => runtime.start(),
    (error: unknown) =>
      error instanceof ProxyRuntimeError && error.code === "PROCESS_CRASH"
  );
  assert.equal(runtime.state(), "STOPPED");
  assert.equal(runtime.getProxyEndpoint(), null);
});

test("Fake Runtime stop success", async () => {
  const runtime = track(new FakeProxyRuntime());
  await runtime.start();
  await runtime.stop();
  assert.equal(runtime.state(), "STOPPED");
  assert.equal(await runtime.healthCheck(), false);
});

test("repeated stop 不报错", async () => {
  const runtime = track(new FakeProxyRuntime());
  await runtime.start();
  await runtime.stop();
  await runtime.stop();
  await runtime.stop();
  assert.equal(runtime.state(), "STOPPED");
});

test("startup timeout", async () => {
  const runtime = track(
    new FakeProxyRuntime({ hangOnStart: true, startupTimeoutMs: 80 })
  );
  await assert.rejects(
    () => runtime.start(),
    (error: unknown) =>
      error instanceof ProxyRuntimeError && error.code === "STARTUP_TIMEOUT"
  );
  assert.equal(runtime.state(), "STOPPED");
});

test("health check timeout", async () => {
  const runtime = track(new FakeProxyRuntime({ healthCheckDelayMs: 400 }));
  await runtime.start();
  await assert.rejects(
    () => healthCheckWithTimeout(runtime, 40),
    (error: unknown) =>
      error instanceof ProxyRuntimeError && error.code === "HEALTHCHECK_TIMEOUT"
  );
});

test("process crash 后 health check 失败", async () => {
  const runtime = track(new FakeProxyRuntime({ crashAfterMs: 40 }));
  await runtime.start();
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(await runtime.healthCheck(), false);
  assert.equal(runtime.getProxyEndpoint(), null);
});

test("自动分配 localhost port，两个 Runtime 不冲突", async () => {
  const left = track(new FakeProxyRuntime());
  const right = track(new FakeProxyRuntime());
  const a = await left.start();
  const b = await right.start();
  assert.equal(a.host, "127.0.0.1");
  assert.equal(b.host, "127.0.0.1");
  assert.notEqual(a.port, b.port);
});

test("stop 后释放端口", async () => {
  const runtime = track(new FakeProxyRuntime());
  const endpoint = await runtime.start();
  await runtime.stop();
  await listenOn(endpoint.port);
});

test("Mihomo ProcessRuntime 使用 stub 子进程启动", async () => {
  await chmod(stubPath, 0o755);
  const runtime = track(
    new MihomoProcessRuntime({ node: ssNode, binaryPath: stubPath })
  );
  const endpoint = await runtime.start();
  assert.equal(runtime.kind, "mihomo");
  assert.equal(endpoint.host, "127.0.0.1");
  assert.equal(await runtime.healthCheck(), true);
  await runtime.stop();
  assert.equal(runtime.state(), "STOPPED");
});

test("缺少二进制时明确失败", async () => {
  const runtime = track(
    new MihomoProcessRuntime({
      node: ssNode,
      binaryPath: "/tmp/baiduren-missing-mihomo",
    })
  );
  await assert.rejects(
    () => runtime.start(),
    (error: unknown) =>
      error instanceof ProxyRuntimeError && error.code === "BINARY_NOT_FOUND"
  );
});

test("子进程立即退出记为 PROCESS_CRASH", async () => {
  await chmod(stubPath, 0o755);
  const runtime = track(
    new MihomoProcessRuntime({
      node: ssNode,
      binaryPath: stubPath,
      extraEnv: { BAIDUREN_STUB_MODE: "crash" },
      startupTimeoutMs: 1000,
    })
  );
  await assert.rejects(
    () => runtime.start(),
    (error: unknown) =>
      error instanceof ProxyRuntimeError && error.code === "PROCESS_CRASH"
  );
  assert.equal(runtime.state(), "STOPPED");
});

test("子进程挂起触发 startup timeout 并被 kill", async () => {
  await chmod(stubPath, 0o755);
  const runtime = track(
    new MihomoProcessRuntime({
      node: ssNode,
      binaryPath: stubPath,
      extraEnv: { BAIDUREN_STUB_MODE: "hang" },
      startupTimeoutMs: 200,
      shutdownTimeoutMs: 500,
    })
  );
  await assert.rejects(
    () => runtime.start(),
    (error: unknown) =>
      error instanceof ProxyRuntimeError && error.code === "STARTUP_TIMEOUT"
  );
  assert.equal(runtime.state(), "STOPPED");
});
