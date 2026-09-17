import { parse as parseYaml } from "yaml";
import { SubscriptionError } from "@/lib/subscription/errors";
import {
  asPort,
  asString,
  cloneRecord,
  isUnsafeServer,
} from "@/lib/subscription/helpers";
import { inferRegionHint } from "@/lib/subscription/region";
import { parseProxyUri } from "@/lib/subscription/uri";
import type {
  NormalizedNode,
  ParseIssue,
  ParseResult,
  SupportedProtocol,
} from "@/lib/subscription/types";

const TYPE_MAP: Record<string, SupportedProtocol | undefined> = {
  ss: "ss",
  shadowsocks: "ss",
  vmess: "vmess",
  trojan: "trojan",
  vless: "vless",
  socks5: "socks5",
  socks: "socks5",
  http: "http",
  https: "http",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clashNetwork(proxy: Record<string, unknown>): string | undefined {
  const network = asString(proxy.network);
  if (network) return network.toLowerCase();
  const plugin = asString(proxy.plugin);
  if (plugin) return plugin.toLowerCase();
  return undefined;
}

function clashSecurity(
  proxy: Record<string, unknown>,
  protocol: SupportedProtocol,
  originalType: string
): string | undefined {
  const security = asString(proxy.security);
  if (security) return security.toLowerCase();
  if (proxy.tls === true || asString(proxy.tls) === "tls") return "tls";
  if (proxy["reality-opts"]) return "reality";
  if (protocol === "trojan") return "tls";
  if (originalType === "https") return "tls";
  return undefined;
}

function clashIdentity(
  proxy: Record<string, unknown>,
  protocol: SupportedProtocol
): string | undefined {
  switch (protocol) {
    case "ss": {
      const cipher = asString(proxy.cipher) ?? asString(proxy.method);
      const password = asString(proxy.password);
      if (!cipher || !password) return undefined;
      return `${cipher}\0${password}`;
    }
    case "vmess":
    case "vless":
      return asString(proxy.uuid) ?? asString(proxy.id);
    case "trojan":
      return asString(proxy.password);
    case "socks5":
    case "http": {
      const user = asString(proxy.username) ?? asString(proxy.user) ?? "";
      const password = asString(proxy.password) ?? "";
      return `${user}\0${password}`;
    }
    default:
      return undefined;
  }
}

function fromClashProxy(proxy: Record<string, unknown>): NormalizedNode | ParseIssue {
  const originalType = (asString(proxy.type) ?? "").toLowerCase();
  if (!originalType) {
    return { code: "INVALID_NODE", name: asString(proxy.name) };
  }

  const protocol = TYPE_MAP[originalType];
  if (!protocol) {
    return {
      code: "UNSUPPORTED_PROTOCOL",
      protocol: originalType,
      name: asString(proxy.name),
    };
  }

  const server = asString(proxy.server);
  const port = asPort(proxy.port);
  const name = asString(proxy.name) || (server && port ? `${protocol}-${server}-${port}` : "");
  if (!server || port == null || isUnsafeServer(server) || !name) {
    return { code: "INVALID_NODE", protocol, name: asString(proxy.name) };
  }

  const identity = clashIdentity(proxy, protocol);
  if (identity == null && (protocol === "ss" || protocol === "vmess" || protocol === "vless" || protocol === "trojan")) {
    return { code: "INVALID_NODE", protocol, name };
  }

  const network = clashNetwork(proxy);
  const security = clashSecurity(proxy, protocol, originalType);
  const uuid = asString(proxy.uuid) ?? asString(proxy.id);

  return {
    name,
    protocol,
    server,
    port,
    regionHint: inferRegionHint(name),
    sourceFormat: "clash-yaml",
    rawConfig: {
      ...cloneRecord(proxy),
      name,
      type: protocol,
      server,
      port,
      uuid,
      // Clash `https` is an HTTP proxy with TLS. Keep tls so Runtime does not
      // treat it as plaintext HTTP.
      ...(security === "tls" || originalType === "https" ? { tls: true } : {}),
    },
    metadata: {
      network,
      security,
      identity,
    },
  };
}

export function looksLikeClashYaml(text: string) {
  return /(^|\n)\s*proxies\s*:/m.test(text);
}

export function parseClashYaml(text: string): ParseResult {
  let document: unknown;
  try {
    document = parseYaml(text, { maxAliasCount: 50 });
  } catch {
    throw new SubscriptionError("INVALID_YAML");
  }

  const nodes: NormalizedNode[] = [];
  const unsupported: ParseIssue[] = [];
  const invalid: ParseIssue[] = [];

  if (document == null) {
    return { nodes, unsupported, invalid };
  }

  const root = isRecord(document) ? document : null;
  const proxies = root ? root.proxies : undefined;
  if (proxies == null) {
    return { nodes, unsupported, invalid };
  }
  if (!Array.isArray(proxies)) {
    throw new SubscriptionError("INVALID_YAML");
  }

  for (const item of proxies) {
    if (typeof item === "string") {
      const parsed = parseProxyUri(item, "clash-yaml");
      if ("rawConfig" in parsed) {
        nodes.push(parsed);
      } else if (parsed.code === "UNSUPPORTED_PROTOCOL") {
        unsupported.push(parsed);
      } else {
        invalid.push(parsed);
      }
      continue;
    }
    if (!isRecord(item)) {
      invalid.push({ code: "INVALID_NODE" });
      continue;
    }
    const parsed = fromClashProxy(item);
    if ("rawConfig" in parsed) {
      nodes.push(parsed);
    } else if (parsed.code === "UNSUPPORTED_PROTOCOL") {
      unsupported.push(parsed);
    } else {
      invalid.push(parsed);
    }
  }

  return { nodes, unsupported, invalid };
}
