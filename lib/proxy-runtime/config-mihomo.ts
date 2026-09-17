import { stringify } from "yaml";
import { asString } from "@/lib/subscription/helpers";
import { LOCALHOST } from "@/lib/proxy-runtime/constants";
import { ProxyRuntimeError } from "@/lib/proxy-runtime/errors";
import { httpUsesTls, loadRuntimeNode } from "@/lib/proxy-runtime/node-input";
import type { RuntimeNodeInput } from "@/lib/proxy-runtime/types";

const NODE_NAME = "baiduren-node";

function pick(raw: Record<string, unknown>, keys: string[]) {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (raw[key] !== undefined) out[key] = raw[key];
  }
  return out;
}

function clashProxy(node: RuntimeNodeInput): Record<string, unknown> {
  const loaded = loadRuntimeNode(node);
  const { protocol, raw, server, port } = loaded;
  const tls = httpUsesTls(raw, protocol);

  switch (protocol) {
    case "ss": {
      const cipher = asString(raw.cipher) ?? asString(raw.method);
      const password = asString(raw.password);
      if (!cipher || !password) throw new ProxyRuntimeError("INVALID_NODE");
      return {
        name: NODE_NAME,
        type: "ss",
        server,
        port,
        cipher,
        password,
        ...pick(raw, ["plugin", "plugin-opts", "udp"]),
      };
    }
    case "vmess": {
      const uuid = asString(raw.uuid) ?? asString(raw.id);
      if (!uuid) throw new ProxyRuntimeError("INVALID_NODE");
      return {
        name: NODE_NAME,
        type: "vmess",
        server,
        port,
        uuid,
        alterId: raw.alterId ?? 0,
        cipher: asString(raw.cipher) ?? "auto",
        network: asString(raw.network) ?? "tcp",
        tls: raw.tls === true || asString(raw.tls) === "tls",
        ...pick(raw, ["servername", "ws-opts", "grpc-opts", "udp", "skip-cert-verify"]),
      };
    }
    case "vless": {
      const uuid = asString(raw.uuid) ?? asString(raw.id);
      if (!uuid) throw new ProxyRuntimeError("INVALID_NODE");
      return {
        name: NODE_NAME,
        type: "vless",
        server,
        port,
        uuid,
        network: asString(raw.network) ?? "tcp",
        tls: raw.tls === true || asString(raw.tls) === "tls",
        ...pick(raw, [
          "servername",
          "flow",
          "reality-opts",
          "ws-opts",
          "client-fingerprint",
          "udp",
          "skip-cert-verify",
        ]),
      };
    }
    case "trojan": {
      const password = asString(raw.password);
      if (!password) throw new ProxyRuntimeError("INVALID_NODE");
      return {
        name: NODE_NAME,
        type: "trojan",
        server,
        port,
        password,
        sni: asString(raw.sni) ?? asString(raw.servername),
        network: asString(raw.network) ?? "tcp",
        ...pick(raw, ["ws-opts", "udp", "skip-cert-verify", "alpn"]),
      };
    }
    case "socks5":
      return {
        name: NODE_NAME,
        type: "socks5",
        server,
        port,
        ...pick(raw, ["username", "password", "tls", "udp", "skip-cert-verify"]),
      };
    case "http":
      return {
        name: NODE_NAME,
        type: "http",
        server,
        port,
        tls,
        ...pick(raw, ["username", "password", "skip-cert-verify", "sni"]),
      };
    default:
      throw new ProxyRuntimeError("UNSUPPORTED_PROTOCOL");
  }
}

export type MihomoListenPorts = {
  mixedPort: number;
  controllerPort: number;
  secret: string;
};

export function buildMihomoConfig(
  node: RuntimeNodeInput,
  ports: MihomoListenPorts
) {
  const proxy = clashProxy(node);
  const document = {
    "mixed-port": ports.mixedPort,
    "bind-address": LOCALHOST,
    "allow-lan": false,
    mode: "global",
    "log-level": "silent",
    ipv6: false,
    "external-controller": `${LOCALHOST}:${ports.controllerPort}`,
    secret: ports.secret,
    dns: { enable: false },
    proxies: [proxy],
    "proxy-groups": [
      {
        name: "PROXY",
        type: "select",
        proxies: [NODE_NAME],
      },
    ],
    rules: ["MATCH,PROXY"],
  };
  return stringify(document);
}

export function assertLocalhostOnlyConfig(yamlText: string) {
  if (/\b0\.0\.0\.0\b/.test(yamlText) || /\[::\]/.test(yamlText)) {
    throw new ProxyRuntimeError("INVALID_NODE");
  }
}
