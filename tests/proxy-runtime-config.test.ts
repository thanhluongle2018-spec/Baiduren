import assert from "node:assert/strict";
import { test } from "node:test";
import { parse as parseYaml } from "yaml";
import { buildMihomoConfig } from "../lib/proxy-runtime/config-mihomo";
import { ProxyRuntimeError } from "../lib/proxy-runtime/errors";
import type { RuntimeNodeInput } from "../lib/proxy-runtime/types";

const ports = {
  mixedPort: 18081,
  controllerPort: 18082,
  secret: "runtime-controller-secret",
};

function asRecord(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === "object");
  return value as Record<string, unknown>;
}

function generated(node: RuntimeNodeInput) {
  const yamlText = buildMihomoConfig(node, ports);
  const document = asRecord(parseYaml(yamlText));
  const proxies = document.proxies;
  assert.ok(Array.isArray(proxies));
  const proxy = asRecord(proxies[0]);
  return { yamlText, document, proxy };
}

test("正确生成 SS config", () => {
  const { document, proxy } = generated({
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
  });
  assert.equal(document["bind-address"], "127.0.0.1");
  assert.equal(document["allow-lan"], false);
  assert.equal(document["mixed-port"], 18081);
  assert.equal(proxy.type, "ss");
  assert.equal(proxy.server, "hk.example.invalid");
  assert.equal(proxy.port, 8388);
  assert.equal(typeof proxy.password, "string");
  assert.equal(String(proxy.password).length > 0, true);
});

test("正确生成 VMess config", () => {
  const { proxy } = generated({
    name: "美国 01",
    protocol: "vmess",
    server: "us.example.invalid",
    port: 443,
    rawConfig: {
      type: "vmess",
      uuid: "11111111-aaaa-bbbb-cccc-111111111111",
      network: "ws",
      tls: true,
      server: "us.example.invalid",
      port: 443,
    },
  });
  assert.equal(proxy.type, "vmess");
  assert.equal(proxy.tls, true);
  assert.equal(proxy.network, "ws");
  assert.equal(typeof proxy.uuid, "string");
});

test("正确生成 VLESS config", () => {
  const { proxy } = generated({
    name: "新加坡 01",
    protocol: "vless",
    server: "sg.example.invalid",
    port: 443,
    rawConfig: {
      type: "vless",
      uuid: "22222222-aaaa-bbbb-cccc-222222222222",
      flow: "xtls-rprx-vision",
      tls: true,
      server: "sg.example.invalid",
      port: 443,
    },
  });
  assert.equal(proxy.type, "vless");
  assert.equal(proxy.flow, "xtls-rprx-vision");
});

test("正确生成 Trojan config", () => {
  const { proxy } = generated({
    name: "台湾 01",
    protocol: "trojan",
    server: "tw.example.invalid",
    port: 443,
    rawConfig: {
      type: "trojan",
      password: "fake-trojan-token-4k2m",
      sni: "tw.example.invalid",
      server: "tw.example.invalid",
      port: 443,
    },
  });
  assert.equal(proxy.type, "trojan");
  assert.equal(proxy.sni, "tw.example.invalid");
});

test("HTTPS HTTP 节点带 tls，不会生成明文 HTTP", () => {
  const { proxy } = generated({
    name: "HTTPS 入口",
    protocol: "http",
    server: "https-proxy.example.invalid",
    port: 443,
    rawConfig: {
      type: "http",
      tls: true,
      server: "https-proxy.example.invalid",
      port: 443,
    },
  });
  assert.equal(proxy.type, "http");
  assert.equal(proxy.tls, true);
});

test("unsupported protocol 明确失败", () => {
  assert.throws(
    () =>
      generated({
        name: "实验",
        protocol: "hysteria2",
        server: "hy.example.invalid",
        port: 443,
        rawConfig: {
          type: "hysteria2",
          password: "fake-hy-password",
          server: "hy.example.invalid",
          port: 443,
        },
      }),
    (error: unknown) =>
      error instanceof ProxyRuntimeError &&
      error.code === "UNSUPPORTED_PROTOCOL" &&
      !error.message.includes("fake-hy-password")
  );
});

test("配置只监听 localhost", () => {
  const { yamlText, document } = generated({
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
  });
  assert.equal(/\b0\.0\.0\.0\b/.test(yamlText), false);
  assert.equal(document["bind-address"], "127.0.0.1");
  assert.equal(String(document["external-controller"]).startsWith("127.0.0.1:"), true);
});
