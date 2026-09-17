import assert from "node:assert/strict";
import { chmod, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { FakeProxyRuntime } from "../lib/proxy-runtime/fake-runtime";
import { startProbeFixture } from "../lib/proxy-runtime/fixture";
import { MihomoProcessRuntime } from "../lib/proxy-runtime/process-runtime";
import { probeViaProxy } from "../lib/proxy-runtime/probe";
import { ProxyRuntimeError } from "../lib/proxy-runtime/errors";
import { containsSecret } from "../lib/subscription/secrets";
import type { ProxyRuntime, RuntimeNodeInput } from "../lib/proxy-runtime/types";

const SECRET_PASSWORD = "fake-ss-password-9f3c";
const SECRET_UUID = "11111111-aaaa-bbbb-cccc-111111111111";
const SECRET_TOKEN = "fake-trojan-token-4k2m";

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
    password: SECRET_PASSWORD,
    server: "hk.example.invalid",
    port: 8388,
  },
};

const runtimes: ProxyRuntime[] = [];
const fixtures: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.stop()));
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.close()));
});

function getJson(url: string) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    http
      .get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk as Buffer));
        res.on("end", () => {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>);
        });
      })
      .on("error", reject);
  });
}

test("HTTP client → Fake Proxy → Fixture Server 证明流量经过 proxy", async () => {
  const fixture = startProbeFixture();
  fixtures.push(fixture);
  const targetUrl = await fixture.url();
  const runtime = new FakeProxyRuntime();
  runtimes.push(runtime);
  const endpoint = await runtime.start();

  const direct = await getJson(targetUrl);
  assert.equal(direct.via, null);

  const proxied = await probeViaProxy({
    endpoint,
    targetUrl,
    expectedVia: runtime.id,
  });
  assert.equal(proxied.success, true);
  assert.equal(proxied.viaProxy, true);
  assert.equal(proxied.viaToken, runtime.id);
  assert.equal(typeof proxied.latencyMs, "number");
  assert.equal(fixture.requests.some((item) => item.via === runtime.id), true);
});

test("ProcessRuntime stub 转发请求也会打上 via 标记", async () => {
  await chmod(stubPath, 0o755);
  const fixture = startProbeFixture();
  fixtures.push(fixture);
  const targetUrl = await fixture.url();
  const runtime = new MihomoProcessRuntime({
    node: ssNode,
    binaryPath: stubPath,
  });
  runtimes.push(runtime);
  const endpoint = await runtime.start();
  const proxied = await probeViaProxy({ endpoint, targetUrl });
  assert.equal(proxied.success, true);
  assert.equal(proxied.viaToken, "mihomo-stub");
  assert.equal(proxied.viaProxy, true);
});

test("拒绝非 localhost 探测目标", async () => {
  const runtime = new FakeProxyRuntime();
  runtimes.push(runtime);
  const endpoint = await runtime.start();
  const result = await probeViaProxy({
    endpoint,
    targetUrl: "http://example.invalid/probe",
  });
  assert.equal(result.success, false);
  assert.equal(result.errorCode, "PROBE_TARGET_INVALID");
});

test("UUID / password / token 不出现在错误信息", async () => {
  const runtime = new MihomoProcessRuntime({
    node: {
      name: "美国 01",
      protocol: "vmess",
      server: "us.example.invalid",
      port: 443,
      rawConfig: {
        type: "vmess",
        uuid: SECRET_UUID,
        password: SECRET_PASSWORD,
        token: SECRET_TOKEN,
        server: "us.example.invalid",
        port: 443,
      },
    },
    binaryPath: "/tmp/baiduren-missing-mihomo",
  });
  runtimes.push(runtime);
  try {
    await runtime.start();
    assert.fail("expected start failure");
  } catch (error) {
    assert.ok(error instanceof ProxyRuntimeError);
    const text = `${error.message}\n${error.stack ?? ""}`;
    assert.equal(containsSecret(text, [SECRET_UUID, SECRET_PASSWORD, SECRET_TOKEN]), false);
  }
});

test("临时配置结束后删除，运行期间权限受限", async () => {
  await chmod(stubPath, 0o755);
  const runtime = new MihomoProcessRuntime({
    node: ssNode,
    binaryPath: stubPath,
  });
  runtimes.push(runtime);
  await runtime.start();
  const dir = runtime.workDirectory();
  assert.ok(dir);
  const configPath = path.join(dir, "config.yaml");
  assert.equal(existsSync(configPath), true);
  const configStat = await stat(configPath);
  const dirStat = await stat(dir);
  assert.equal(configStat.mode & 0o777, 0o600);
  assert.equal(dirStat.mode & 0o777, 0o700);
  await runtime.stop();
  assert.equal(existsSync(configPath), false);
  assert.equal(existsSync(dir), false);
  assert.equal(runtime.workDirectory(), null);
});
