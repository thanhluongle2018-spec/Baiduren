import assert from "node:assert/strict";
import { test } from "node:test";
import { nodeFingerprint } from "../lib/subscription/fingerprint";
import { parseSubscriptionContent } from "../lib/subscription/parse";
import { inferRegionHint } from "../lib/subscription/region";
import { MAX_SUBSCRIPTION_BYTES } from "../lib/subscription/types";
import { SubscriptionError } from "../lib/subscription/errors";

const SS_PASSWORD = "fake-ss-password-9f3c";
const VMESS_UUID = "11111111-aaaa-bbbb-cccc-111111111111";
const TROJAN_PASSWORD = "fake-trojan-token-4k2m";
const VLESS_UUID = "22222222-aaaa-bbbb-cccc-222222222222";

function ssUri(name: string, host = "hk.example.invalid", port = 8388) {
  const userinfo = Buffer.from(`aes-256-gcm:${SS_PASSWORD}`).toString("base64");
  return `ss://${userinfo}@${host}:${port}#${encodeURIComponent(name)}`;
}

function vmessUri(name = "日本 01") {
  return `vmess://${Buffer.from(
    JSON.stringify({
      v: "2",
      ps: name,
      add: "jp.example.invalid",
      port: "443",
      id: VMESS_UUID,
      aid: "0",
      net: "ws",
      type: "none",
      host: "jp.example.invalid",
      path: "/vmess",
      tls: "tls",
    })
  ).toString("base64")}`;
}

function trojanUri(name = "台湾 01") {
  return `trojan://${TROJAN_PASSWORD}@tw.example.invalid:443?security=tls&sni=tw.example.invalid#${encodeURIComponent(name)}`;
}

function vlessUri(name = "新加坡 01") {
  return `vless://${VLESS_UUID}@sg.example.invalid:443?type=ws&security=tls&sni=sg.example.invalid&path=%2Fvless#${encodeURIComponent(name)}`;
}

function clashYaml() {
  return `proxies:
  - name: 香港 01
    type: ss
    server: hk.example.invalid
    port: 8388
    cipher: aes-256-gcm
    password: ${SS_PASSWORD}
  - name: 美国 01
    type: vmess
    server: us.example.invalid
    port: 443
    uuid: ${VMESS_UUID}
    alterId: 0
    cipher: auto
    network: ws
    tls: true
  - name: 日本中转
    type: trojan
    server: jp.example.invalid
    port: 443
    password: ${TROJAN_PASSWORD}
    sni: jp.example.invalid
  - name: 新加坡 01
    type: vless
    server: sg.example.invalid
    port: 443
    uuid: ${VLESS_UUID}
    network: ws
    tls: true
  - name: SOCKS 香港
    type: socks5
    server: socks.example.invalid
    port: 1080
    username: fake-user
    password: fake-socks-pass
  - name: HTTP 台湾
    type: http
    server: http.example.invalid
    port: 8081
`;
}

test("YAML proxies 解析常见 Clash 协议", () => {
  const result = parseSubscriptionContent(clashYaml());
  assert.equal(result.nodes.length, 6);
  assert.equal(result.unsupported.length, 0);
  assert.equal(result.invalid.length, 0);
  const byProtocol = Object.fromEntries(result.nodes.map((node) => [node.protocol, node]));
  assert.equal(byProtocol.ss.server, "hk.example.invalid");
  assert.equal(byProtocol.ss.port, 8388);
  assert.equal(byProtocol.ss.sourceFormat, "clash-yaml");
  assert.equal(byProtocol.vmess.regionHint, "US");
  assert.equal(byProtocol.trojan.regionHint, "JP");
  assert.equal(byProtocol.vless.protocol, "vless");
  assert.equal(byProtocol.socks5.protocol, "socks5");
  assert.equal(byProtocol.http.protocol, "http");
  assert.equal(byProtocol.ss.rawConfig.password, SS_PASSWORD);
});

test("Clash https 节点保留 TLS，不会当成明文 HTTP", () => {
  const result = parseSubscriptionContent(`proxies:
  - name: HTTPS 入口
    type: https
    server: https-proxy.example.invalid
    port: 443
    username: fake-user
    password: ${SS_PASSWORD}
`);
  assert.equal(result.nodes.length, 1);
  assert.equal(result.nodes[0].protocol, "http");
  assert.equal(result.nodes[0].metadata.security, "tls");
  assert.equal(result.nodes[0].rawConfig.tls, true);
  assert.equal(result.nodes[0].rawConfig.type, "http");
});

test("空 proxies 返回零节点", () => {
  const result = parseSubscriptionContent("proxies: []\n");
  assert.equal(result.nodes.length, 0);
  assert.equal(result.unsupported.length, 0);
  assert.equal(result.invalid.length, 0);
});

test("非法 YAML 抛出 INVALID_YAML", () => {
  assert.throws(
    () =>
      parseSubscriptionContent(`proxies:
  - name: broken
    password: ${SS_PASSWORD}
    type: [ss
`),
    (error: unknown) =>
      error instanceof SubscriptionError &&
      error.code === "INVALID_YAML" &&
      !error.message.includes(SS_PASSWORD)
  );
});

test("base64 URI 列表解析", () => {
  const list = [ssUri("香港 01"), vmessUri(), trojanUri(), vlessUri()].join("\n");
  const encoded = Buffer.from(list, "utf8").toString("base64");
  const result = parseSubscriptionContent(encoded);
  assert.equal(result.nodes.length, 4);
  assert.deepEqual(
    result.nodes.map((node) => node.protocol).sort(),
    ["ss", "trojan", "vless", "vmess"]
  );
  assert.equal(result.nodes[0].sourceFormat, "uri-list");
});

test("单个 ss URI", () => {
  const result = parseSubscriptionContent(ssUri("香港 IEPL"));
  assert.equal(result.nodes.length, 1);
  assert.equal(result.nodes[0].protocol, "ss");
  assert.equal(result.nodes[0].server, "hk.example.invalid");
  assert.equal(result.nodes[0].port, 8388);
  assert.equal(result.nodes[0].sourceFormat, "uri");
  assert.equal(result.nodes[0].regionHint, "HK");
});

test("vmess URI", () => {
  const result = parseSubscriptionContent(vmessUri("东京 01"));
  assert.equal(result.nodes.length, 1);
  assert.equal(result.nodes[0].protocol, "vmess");
  assert.equal(result.nodes[0].server, "jp.example.invalid");
  assert.equal(result.nodes[0].metadata.identity, VMESS_UUID);
  assert.equal(result.nodes[0].metadata.network, "ws");
  assert.equal(result.nodes[0].regionHint, "JP");
});

test("trojan URI", () => {
  const result = parseSubscriptionContent(trojanUri());
  assert.equal(result.nodes.length, 1);
  assert.equal(result.nodes[0].protocol, "trojan");
  assert.equal(result.nodes[0].server, "tw.example.invalid");
  assert.equal(result.nodes[0].regionHint, "TW");
});

test("vless URI", () => {
  const result = parseSubscriptionContent(vlessUri());
  assert.equal(result.nodes.length, 1);
  assert.equal(result.nodes[0].protocol, "vless");
  assert.equal(result.nodes[0].server, "sg.example.invalid");
  assert.equal(result.nodes[0].metadata.identity, VLESS_UUID);
  assert.equal(result.nodes[0].regionHint, "SG");
});

test("unsupported protocol 返回 UNSUPPORTED_PROTOCOL", () => {
  const yaml = `proxies:
  - name: 实验节点
    type: hysteria2
    server: hy.example.invalid
    port: 443
    password: ${TROJAN_PASSWORD}
  - name: 香港 01
    type: ss
    server: hk.example.invalid
    port: 8388
    cipher: aes-256-gcm
    password: ${SS_PASSWORD}
`;
  const result = parseSubscriptionContent(yaml);
  assert.equal(result.nodes.length, 1);
  assert.equal(result.unsupported.length, 1);
  assert.equal(result.unsupported[0].code, "UNSUPPORTED_PROTOCOL");
  assert.equal(result.unsupported[0].protocol, "hysteria2");
});

test("malformed URI 记为 MALFORMED_URI", () => {
  const result = parseSubscriptionContent("ss://%%%-not-base64");
  assert.equal(result.nodes.length, 0);
  assert.equal(result.invalid.length, 1);
  assert.equal(result.invalid[0].code, "MALFORMED_URI");
});

test("regionHint 只做名称推断", () => {
  assert.equal(inferRegionHint("香港 IEPL"), "HK");
  assert.equal(inferRegionHint("HK-01"), "HK");
  assert.equal(inferRegionHint("Hong Kong"), "HK");
  assert.equal(inferRegionHint("日本东京"), "JP");
  assert.equal(inferRegionHint("JP-NRT"), "JP");
  assert.equal(inferRegionHint("美国 01"), "US");
  assert.equal(inferRegionHint("USA West"), "US");
  assert.equal(inferRegionHint("台湾 TW"), "TW");
  assert.equal(inferRegionHint("Singapore SG"), "SG");
  assert.equal(inferRegionHint("欧洲 01"), "UNKNOWN");
});

test("fingerprint 对同一节点保持稳定，且不含明文 secret", () => {
  const first = parseSubscriptionContent(clashYaml()).nodes.find((node) => node.protocol === "ss");
  const renamed = parseSubscriptionContent(`proxies:
  - name: 香港改名
    type: ss
    server: hk.example.invalid
    port: 8388
    cipher: aes-256-gcm
    password: ${SS_PASSWORD}
`).nodes[0];
  assert.ok(first);
  const left = nodeFingerprint("airport-a", first);
  const right = nodeFingerprint("airport-a", renamed);
  assert.equal(left, right);
  assert.notEqual(nodeFingerprint("airport-b", first), left);
  assert.equal(left.includes(SS_PASSWORD), false);
  assert.match(left, /^[a-f0-9]{64}$/);
});

test("超大输入被拒绝", () => {
  const oversized = "a".repeat(MAX_SUBSCRIPTION_BYTES + 1);
  assert.throws(
    () => parseSubscriptionContent(oversized),
    (error: unknown) =>
      error instanceof SubscriptionError && error.code === "CONTENT_TOO_LARGE"
  );
});

test("本地文件路径不会被当成节点", () => {
  const result = parseSubscriptionContent(`proxies:
  - name: 非法路径
    type: ss
    server: /etc/passwd
    port: 8388
    cipher: aes-256-gcm
    password: ${SS_PASSWORD}
  - name: file URI
    type: ss
    server: file:///tmp/fake
    port: 8388
    cipher: aes-256-gcm
    password: ${SS_PASSWORD}
`);
  assert.equal(result.nodes.length, 0);
  assert.equal(result.invalid.length, 2);
  assert.equal(result.invalid[0].code, "INVALID_NODE");
});
