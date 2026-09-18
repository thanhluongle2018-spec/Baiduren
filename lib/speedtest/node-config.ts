/**
 * C2: Node → RealSpeedTestExecutor input adapter.
 * ValidatedNodeConfig is server-side only. Never log, stringify, or return
 * it from a public API. Debug output must go through summarizeValidatedNodeConfig().
 */

import net from "node:net";
import { SpeedTestEngineError } from "@/lib/speedtest/engine-error";
import type { RuntimeNodeInput } from "@/lib/proxy-runtime/types";
import {
  asPort,
  asString,
  isSupportedProtocol,
  isUnsafeServer,
} from "@/lib/subscription/helpers";
import {
  SUPPORTED_PROTOCOLS,
  type SupportedProtocol,
} from "@/lib/subscription/types";

export const REAL_EXECUTOR_NODE_PROTOCOLS = SUPPORTED_PROTOCOLS;

export type NodeConfigSource = {
  name?: string | null;
  protocol?: string | null;
  server?: string | null;
  port?: number | string | null;
  rawConfig?: string | Record<string, unknown> | null;
};

export type ValidatedWsOpts = {
  path?: string;
  headers?: Record<string, string>;
};

export type ValidatedGrpcOpts = {
  serviceName?: string;
};

export type ValidatedH2Opts = {
  path?: string;
  host?: string | string[];
};

export type ValidatedRealityOpts = {
  publicKey?: string;
  shortId?: string;
};

export type ValidatedNodeTransport =
  | "tcp"
  | "ws"
  | "grpc"
  | "h2"
  | "http"
  | "plugin"
  | "unknown";

type ValidatedNodeBase = {
  protocol: SupportedProtocol;
  name: string;
  server: string;
  port: number;
  tls: boolean;
  transport: ValidatedNodeTransport;
};

export type ValidatedSsConfig = ValidatedNodeBase & {
  protocol: "ss";
  cipher: string;
  password: string;
  plugin?: string;
  pluginOpts?: string | Record<string, unknown>;
};

export type ValidatedVmessConfig = ValidatedNodeBase & {
  protocol: "vmess";
  uuid: string;
  alterId?: number;
  cipher?: string;
  serverName?: string;
  fingerprint?: string;
  ws?: ValidatedWsOpts;
  grpc?: ValidatedGrpcOpts;
  h2?: ValidatedH2Opts;
  skipCertVerify?: boolean;
};

export type ValidatedVlessConfig = ValidatedNodeBase & {
  protocol: "vless";
  uuid: string;
  encryption?: string;
  flow?: string;
  serverName?: string;
  fingerprint?: string;
  reality?: ValidatedRealityOpts;
  ws?: ValidatedWsOpts;
  grpc?: ValidatedGrpcOpts;
  h2?: ValidatedH2Opts;
  skipCertVerify?: boolean;
};

export type ValidatedTrojanConfig = ValidatedNodeBase & {
  protocol: "trojan";
  password: string;
  serverName?: string;
  fingerprint?: string;
  ws?: ValidatedWsOpts;
  grpc?: ValidatedGrpcOpts;
  h2?: ValidatedH2Opts;
  alpn?: string | string[];
  skipCertVerify?: boolean;
};

export type ValidatedSocks5Config = ValidatedNodeBase & {
  protocol: "socks5";
  username?: string;
  password?: string;
  skipCertVerify?: boolean;
};

export type ValidatedHttpConfig = ValidatedNodeBase & {
  protocol: "http";
  username?: string;
  password?: string;
  serverName?: string;
  skipCertVerify?: boolean;
};

export type ValidatedNodeConfig =
  | ValidatedSsConfig
  | ValidatedVmessConfig
  | ValidatedVlessConfig
  | ValidatedTrojanConfig
  | ValidatedSocks5Config
  | ValidatedHttpConfig;

export type ValidatedNodeConfigSummary = {
  protocol: SupportedProtocol;
  serverPresent: boolean;
  port: number;
  transport: ValidatedNodeTransport;
  tls: boolean;
};

const INSPECT = Symbol.for("nodejs.util.inspect.custom");

function fail(code: "INVALID_NODE" | "NODE_UNSUPPORTED"): never {
  throw new SpeedTestEngineError(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseRawConfig(raw: NodeConfigSource["rawConfig"]): Record<string, unknown> {
  if (raw == null || raw === "") return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (isRecord(parsed)) return parsed;
    } catch {
      fail("INVALID_NODE");
    }
    fail("INVALID_NODE");
  }
  if (isRecord(raw)) return { ...raw };
  fail("INVALID_NODE");
}

function resolveProtocol(node: NodeConfigSource, raw: Record<string, unknown>): SupportedProtocol {
  const originalType = (asString(raw.type) ?? asString(node.protocol) ?? "").toLowerCase();
  if (!originalType) fail("INVALID_NODE");
  if (originalType === "https") return "http";
  if (originalType === "socks") return "socks5";
  if (originalType === "shadowsocks") return "ss";
  if (!isSupportedProtocol(originalType)) fail("NODE_UNSUPPORTED");
  return originalType;
}

function asNonNegativeInt(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isInteger(parsed) && parsed >= 0) return parsed;
  }
  return undefined;
}

function asBooleanFlag(value: unknown): boolean | undefined {
  if (value === true) return true;
  if (value === false) return false;
  const text = asString(value)?.toLowerCase();
  if (text === "true" || text === "tls" || text === "1") return true;
  if (text === "false" || text === "none" || text === "0") return false;
  return undefined;
}

function asStringList(value: unknown): string | string[] | undefined {
  const single = asString(value);
  if (single) return single;
  if (!Array.isArray(value)) return undefined;
  const items = value.map((item) => asString(item)).filter((item): item is string => Boolean(item));
  return items.length > 0 ? items : undefined;
}

function asStringRecord(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    const text = asString(entry);
    if (text) out[key] = text;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function pickWs(raw: Record<string, unknown>): ValidatedWsOpts | undefined {
  const opts = isRecord(raw["ws-opts"]) ? raw["ws-opts"] : isRecord(raw.wsOpts) ? raw.wsOpts : null;
  if (!opts) return undefined;
  const path = asString(opts.path);
  const headers = asStringRecord(opts.headers);
  if (!path && !headers) return undefined;
  return {
    ...(path ? { path } : {}),
    ...(headers ? { headers } : {}),
  };
}

function pickGrpc(raw: Record<string, unknown>): ValidatedGrpcOpts | undefined {
  const opts = isRecord(raw["grpc-opts"]) ? raw["grpc-opts"] : isRecord(raw.grpcOpts) ? raw.grpcOpts : null;
  if (!opts) return undefined;
  const serviceName =
    asString(opts["grpc-service-name"]) ?? asString(opts.serviceName);
  return serviceName ? { serviceName } : undefined;
}

function pickH2(raw: Record<string, unknown>): ValidatedH2Opts | undefined {
  const opts = isRecord(raw["h2-opts"]) ? raw["h2-opts"] : isRecord(raw.h2Opts) ? raw.h2Opts : null;
  if (!opts) return undefined;
  const path = asString(opts.path);
  const host = asStringList(opts.host);
  if (!path && !host) return undefined;
  return {
    ...(path ? { path } : {}),
    ...(host ? { host } : {}),
  };
}

function pickReality(raw: Record<string, unknown>): ValidatedRealityOpts | undefined {
  const opts =
    isRecord(raw["reality-opts"]) ? raw["reality-opts"] : isRecord(raw.realityOpts) ? raw.realityOpts : null;
  if (!opts) return undefined;
  const publicKey = asString(opts["public-key"]) ?? asString(opts.publicKey);
  const shortId = asString(opts["short-id"]) ?? asString(opts.shortId);
  if (!publicKey && !shortId) return undefined;
  return {
    ...(publicKey ? { publicKey } : {}),
    ...(shortId ? { shortId } : {}),
  };
}

function pickFingerprint(raw: Record<string, unknown>): string | undefined {
  return (
    asString(raw["client-fingerprint"]) ??
    asString(raw.fingerprint) ??
    asString(raw.fp)
  );
}

function pickServerName(raw: Record<string, unknown>): string | undefined {
  return asString(raw.servername) ?? asString(raw.sni) ?? asString(raw.serverName);
}

function pickSkipCertVerify(raw: Record<string, unknown>): boolean | undefined {
  return asBooleanFlag(raw["skip-cert-verify"] ?? raw.skipCertVerify);
}

function inferTransport(raw: Record<string, unknown>, protocol: SupportedProtocol): ValidatedNodeTransport {
  const network = asString(raw.network)?.toLowerCase();
  if (network === "ws" || network === "websocket") return "ws";
  if (network === "grpc") return "grpc";
  if (network === "h2") return "h2";
  if (network === "http" || network === "h3") return network === "h3" ? "unknown" : "http";
  if (network === "tcp" || network === "raw") return "tcp";
  if (protocol === "ss" && asString(raw.plugin)) return "plugin";
  if (!network) return "tcp";
  return "unknown";
}

function inferTls(
  raw: Record<string, unknown>,
  protocol: SupportedProtocol,
  originalType: string
): boolean {
  const flag = asBooleanFlag(raw.tls);
  if (flag != null) return flag;
  const security = asString(raw.security)?.toLowerCase();
  if (security === "tls" || security === "reality") return true;
  if (raw["reality-opts"] || raw.realityOpts) return true;
  if (protocol === "trojan") return true;
  if (originalType === "https") return true;
  return false;
}

export function normalizeNodeHost(server: string): string {
  let value = server.trim();
  if (value.startsWith("[") && value.endsWith("]") && value.includes(":")) {
    value = value.slice(1, -1);
  }
  const zone = value.indexOf("%");
  if (zone >= 0) value = value.slice(0, zone);
  return value.trim();
}

function isIpv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const n = Number(part);
    return Number.isInteger(n) && n >= 0 && n <= 255;
  });
}

function isDisallowedIpv4(host: string): boolean {
  if (!isIpv4(host)) return false;
  const parts = host.split(".").map(Number);
  const a = parts[0];
  const b = parts[1];
  if (a == null || b == null) return false;
  if (a === 127) return true;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

function firstIpv6Hextet(host: string): number | null {
  const head = host.split(":")[0];
  if (!head) return 0;
  if (!/^[0-9a-f]{1,4}$/i.test(head)) return null;
  return Number.parseInt(head, 16);
}

function isDisallowedIpv6(host: string): boolean {
  if (net.isIP(host) !== 6) return false;
  const value = host.toLowerCase();
  if (value === "::1") return true;
  if (value === "::") return true;
  if (value.startsWith("::ffff:")) {
    const mapped = value.slice("::ffff:".length);
    if (mapped === "0.0.0.0") return true;
    return isDisallowedIpv4(mapped);
  }
  const first = firstIpv6Hextet(value);
  if (first == null) return false;
  if ((first & 0xffc0) === 0xfe80) return true;
  if ((first & 0xfe00) === 0xfc00) return true;
  return false;
}

/**
 * Rejects localhost / loopback / link-local / RFC1918 private targets.
 * Does not expand into later configured-target SSRF (TEST-NET, CGNAT, DNS rebinding).
 */
export function isDisallowedNodeTarget(server: string): boolean {
  const host = normalizeNodeHost(server).toLowerCase();
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "0.0.0.0" || host === "::" || host === "[::]") return true;
  if (isDisallowedIpv4(host)) return true;
  if (isDisallowedIpv6(host)) return true;
  return false;
}

export function isIllegalNodeHost(server: string): boolean {
  const host = normalizeNodeHost(server);
  if (!host) return true;
  if (isUnsafeServer(host)) return true;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(host)) return true;
  if (host.includes("://")) return true;
  if (/\s/.test(host)) return true;
  return false;
}

function assertPublicNodeTarget(server: string) {
  if (isIllegalNodeHost(server) || isDisallowedNodeTarget(server)) {
    fail("INVALID_NODE");
  }
}

function nodeName(node: NodeConfigSource, raw: Record<string, unknown>, protocol: string, server: string, port: number) {
  return asString(raw.name) ?? asString(node.name) ?? `${protocol}-${server}-${port}`;
}

function seal<T extends ValidatedNodeConfig>(config: T): T {
  const sealed = { ...config };
  Object.defineProperty(sealed, "toJSON", {
    enumerable: false,
    value: () => summarizeValidatedNodeConfig(sealed),
  });
  Object.defineProperty(sealed, INSPECT, {
    enumerable: false,
    value: () => summarizeValidatedNodeConfig(sealed),
  });
  return Object.freeze(sealed);
}

export function summarizeValidatedNodeConfig(node: ValidatedNodeConfig): ValidatedNodeConfigSummary {
  return {
    protocol: node.protocol,
    serverPresent: Boolean(node.server),
    port: node.port,
    transport: node.transport,
    tls: node.tls,
  };
}

export function assertNoRawConfig(node: ValidatedNodeConfig) {
  if ("rawConfig" in node && (node as { rawConfig?: unknown }).rawConfig != null) {
    fail("INVALID_NODE");
  }
}

/**
 * Parse a stored Node (or NormalizedNode) into the only node shape
 * RealSpeedTestExecutor may accept. Original rawConfig is discarded.
 */
export function validateNodeForRealExecutor(node: NodeConfigSource): ValidatedNodeConfig {
  const raw = parseRawConfig(node.rawConfig);
  const originalType = (asString(raw.type) ?? asString(node.protocol) ?? "").toLowerCase();
  const protocol = resolveProtocol(node, raw);
  const server =
    raw.server != null && raw.server !== ""
      ? asString(raw.server)
      : asString(node.server);
  const port =
    raw.port != null && raw.port !== ""
      ? asPort(raw.port)
      : asPort(node.port);
  if (!server || port == null) fail("INVALID_NODE");
  assertPublicNodeTarget(server);

  const name = nodeName(node, raw, protocol, server, port);
  const transport = inferTransport(raw, protocol);
  const tls = inferTls(raw, protocol, originalType);
  const base = { name, server, port, tls, transport };

  switch (protocol) {
    case "ss": {
      const cipher = asString(raw.cipher) ?? asString(raw.method);
      const password = asString(raw.password);
      if (!cipher || !password) fail("INVALID_NODE");
      const plugin = asString(raw.plugin);
      const pluginOpts = raw["plugin-opts"] ?? raw.pluginOpts;
      return seal({
        protocol: "ss",
        ...base,
        cipher,
        password,
        ...(plugin ? { plugin } : {}),
        ...(typeof pluginOpts === "string" || isRecord(pluginOpts) ? { pluginOpts } : {}),
      });
    }
    case "vmess": {
      const uuid = asString(raw.uuid) ?? asString(raw.id);
      if (!uuid) fail("INVALID_NODE");
      const alterId = asNonNegativeInt(raw.alterId ?? raw.aid);
      const cipher = asString(raw.cipher) ?? asString(raw.scy);
      const serverName = pickServerName(raw);
      const fingerprint = pickFingerprint(raw);
      const skipCertVerify = pickSkipCertVerify(raw);
      const ws = pickWs(raw);
      const grpc = pickGrpc(raw);
      const h2 = pickH2(raw);
      return seal({
        protocol: "vmess",
        ...base,
        uuid,
        ...(alterId != null ? { alterId } : {}),
        ...(cipher ? { cipher } : {}),
        ...(serverName ? { serverName } : {}),
        ...(fingerprint ? { fingerprint } : {}),
        ...(ws ? { ws } : {}),
        ...(grpc ? { grpc } : {}),
        ...(h2 ? { h2 } : {}),
        ...(skipCertVerify != null ? { skipCertVerify } : {}),
      });
    }
    case "vless": {
      const uuid = asString(raw.uuid) ?? asString(raw.id);
      if (!uuid) fail("INVALID_NODE");
      const encryption = asString(raw.encryption);
      const flow = asString(raw.flow);
      const serverName = pickServerName(raw);
      const fingerprint = pickFingerprint(raw);
      const skipCertVerify = pickSkipCertVerify(raw);
      const reality = pickReality(raw);
      const ws = pickWs(raw);
      const grpc = pickGrpc(raw);
      const h2 = pickH2(raw);
      return seal({
        protocol: "vless",
        ...base,
        uuid,
        ...(encryption ? { encryption } : {}),
        ...(flow ? { flow } : {}),
        ...(serverName ? { serverName } : {}),
        ...(fingerprint ? { fingerprint } : {}),
        ...(reality ? { reality } : {}),
        ...(ws ? { ws } : {}),
        ...(grpc ? { grpc } : {}),
        ...(h2 ? { h2 } : {}),
        ...(skipCertVerify != null ? { skipCertVerify } : {}),
      });
    }
    case "trojan": {
      const password = asString(raw.password);
      if (!password) fail("INVALID_NODE");
      const serverName = pickServerName(raw);
      const fingerprint = pickFingerprint(raw);
      const alpn = asStringList(raw.alpn);
      const skipCertVerify = pickSkipCertVerify(raw);
      const ws = pickWs(raw);
      const grpc = pickGrpc(raw);
      const h2 = pickH2(raw);
      return seal({
        protocol: "trojan",
        ...base,
        password,
        ...(serverName ? { serverName } : {}),
        ...(fingerprint ? { fingerprint } : {}),
        ...(ws ? { ws } : {}),
        ...(grpc ? { grpc } : {}),
        ...(h2 ? { h2 } : {}),
        ...(alpn ? { alpn } : {}),
        ...(skipCertVerify != null ? { skipCertVerify } : {}),
      });
    }
    case "socks5": {
      const username = asString(raw.username) ?? asString(raw.user);
      const password = asString(raw.password);
      const skipCertVerify = pickSkipCertVerify(raw);
      return seal({
        protocol: "socks5",
        ...base,
        ...(username ? { username } : {}),
        ...(password ? { password } : {}),
        ...(skipCertVerify != null ? { skipCertVerify } : {}),
      });
    }
    case "http": {
      const username = asString(raw.username) ?? asString(raw.user);
      const password = asString(raw.password);
      const serverName = pickServerName(raw);
      const skipCertVerify = pickSkipCertVerify(raw);
      return seal({
        protocol: "http",
        ...base,
        ...(username ? { username } : {}),
        ...(password ? { password } : {}),
        ...(serverName ? { serverName } : {}),
        ...(skipCertVerify != null ? { skipCertVerify } : {}),
      });
    }
    default:
      fail("NODE_UNSUPPORTED");
  }
}

function assignWs(raw: Record<string, unknown>, ws?: ValidatedWsOpts) {
  if (!ws) return;
  raw["ws-opts"] = {
    ...(ws.path ? { path: ws.path } : {}),
    ...(ws.headers ? { headers: ws.headers } : {}),
  };
}

function assignGrpc(raw: Record<string, unknown>, grpc?: ValidatedGrpcOpts) {
  if (!grpc?.serviceName) return;
  raw["grpc-opts"] = { "grpc-service-name": grpc.serviceName };
}

function assignH2(raw: Record<string, unknown>, h2?: ValidatedH2Opts) {
  if (!h2) return;
  raw["h2-opts"] = {
    ...(h2.path ? { path: h2.path } : {}),
    ...(h2.host ? { host: h2.host } : {}),
  };
}

/**
 * Reconstruct an allowlisted RuntimeNodeInput for a future Mihomo path.
 * This is not the original Node.rawConfig blob.
 */
export function toRuntimeNodeInput(node: ValidatedNodeConfig): RuntimeNodeInput {
  assertNoRawConfig(node);
  const raw: Record<string, unknown> = {
    name: node.name,
    type: node.protocol,
    server: node.server,
    port: node.port,
    tls: node.tls,
  };
  if (node.transport !== "plugin" && node.transport !== "unknown") {
    raw.network = node.transport;
  }

  switch (node.protocol) {
    case "ss":
      raw.cipher = node.cipher;
      raw.password = node.password;
      if (node.plugin) raw.plugin = node.plugin;
      if (node.pluginOpts) raw["plugin-opts"] = node.pluginOpts;
      break;
    case "vmess":
      raw.uuid = node.uuid;
      if (node.alterId != null) raw.alterId = node.alterId;
      if (node.cipher) raw.cipher = node.cipher;
      if (node.serverName) raw.servername = node.serverName;
      if (node.fingerprint) raw["client-fingerprint"] = node.fingerprint;
      if (node.skipCertVerify != null) raw["skip-cert-verify"] = node.skipCertVerify;
      assignWs(raw, node.ws);
      assignGrpc(raw, node.grpc);
      assignH2(raw, node.h2);
      break;
    case "vless":
      raw.uuid = node.uuid;
      if (node.encryption) raw.encryption = node.encryption;
      if (node.flow) raw.flow = node.flow;
      if (node.serverName) raw.servername = node.serverName;
      if (node.fingerprint) raw["client-fingerprint"] = node.fingerprint;
      if (node.skipCertVerify != null) raw["skip-cert-verify"] = node.skipCertVerify;
      if (node.reality) {
        raw["reality-opts"] = {
          ...(node.reality.publicKey ? { "public-key": node.reality.publicKey } : {}),
          ...(node.reality.shortId ? { "short-id": node.reality.shortId } : {}),
        };
      }
      assignWs(raw, node.ws);
      assignGrpc(raw, node.grpc);
      assignH2(raw, node.h2);
      break;
    case "trojan":
      raw.password = node.password;
      if (node.serverName) {
        raw.sni = node.serverName;
        raw.servername = node.serverName;
      }
      if (node.fingerprint) raw["client-fingerprint"] = node.fingerprint;
      if (node.alpn) raw.alpn = node.alpn;
      if (node.skipCertVerify != null) raw["skip-cert-verify"] = node.skipCertVerify;
      assignWs(raw, node.ws);
      assignGrpc(raw, node.grpc);
      assignH2(raw, node.h2);
      break;
    case "socks5":
      if (node.username) raw.username = node.username;
      if (node.password) raw.password = node.password;
      if (node.skipCertVerify != null) raw["skip-cert-verify"] = node.skipCertVerify;
      break;
    case "http":
      if (node.username) raw.username = node.username;
      if (node.password) raw.password = node.password;
      if (node.serverName) raw.sni = node.serverName;
      if (node.skipCertVerify != null) raw["skip-cert-verify"] = node.skipCertVerify;
      break;
  }

  return {
    name: node.name,
    protocol: node.protocol,
    server: node.server,
    port: node.port,
    rawConfig: raw,
  };
}
