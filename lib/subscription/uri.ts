import {
  asPort,
  asString,
  decodeBase64Utf8,
  isUnsafeServer,
  parseHostPort,
  safeDecodeURIComponent,
} from "@/lib/subscription/helpers";
import { inferRegionHint } from "@/lib/subscription/region";
import type {
  NormalizedNode,
  ParseIssue,
  SourceFormat,
  SupportedProtocol,
} from "@/lib/subscription/types";

const URI_SCHEME =
  /^(ss|vmess|trojan|vless|socks5|socks|http|https|ssr|hysteria2?|hy2|tuic|wireguard|snell):\/\//i;

const UNSUPPORTED_SCHEMES = new Set([
  "ssr",
  "hysteria",
  "hysteria2",
  "hy2",
  "tuic",
  "wireguard",
  "snell",
  "http",
  "https",
  "socks",
  "socks5",
]);

type UriParts = {
  name: string;
  main: string;
  query: URLSearchParams;
};

function splitUri(raw: string, schemePrefix: string): UriParts {
  const withoutScheme = raw.slice(schemePrefix.length);
  const hash = withoutScheme.indexOf("#");
  const name =
    hash >= 0
      ? safeDecodeURIComponent(withoutScheme.slice(hash + 1)).trim()
      : "";
  const beforeHash = hash >= 0 ? withoutScheme.slice(0, hash) : withoutScheme;
  const queryIndex = beforeHash.indexOf("?");
  const main = queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash;
  const query =
    queryIndex >= 0
      ? new URLSearchParams(beforeHash.slice(queryIndex + 1))
      : new URLSearchParams();
  return { name, main, query };
}

function nodeName(explicit: string, protocol: string, server: string, port: number) {
  return explicit || `${protocol}-${server}-${port}`;
}

function normalized(input: {
  name: string;
  protocol: SupportedProtocol;
  server: string;
  port: number;
  sourceFormat: SourceFormat;
  rawConfig: Record<string, unknown>;
  network?: string;
  security?: string;
  identity?: string;
}): NormalizedNode {
  return {
    name: input.name,
    protocol: input.protocol,
    server: input.server,
    port: input.port,
    regionHint: inferRegionHint(input.name),
    rawConfig: input.rawConfig,
    sourceFormat: input.sourceFormat,
    metadata: {
      network: input.network,
      security: input.security,
      identity: input.identity,
    },
  };
}

function parseUserHost(main: string): {
  user: string;
  password: string;
  host: string;
  port: number;
} | null {
  const at = main.lastIndexOf("@");
  if (at <= 0) return null;
  const userinfo = main.slice(0, at);
  const authority = parseHostPort(main.slice(at + 1));
  if (!authority) return null;
  const colon = userinfo.indexOf(":");
  const user =
    colon >= 0
      ? safeDecodeURIComponent(userinfo.slice(0, colon))
      : safeDecodeURIComponent(userinfo);
  const password =
    colon >= 0 ? safeDecodeURIComponent(userinfo.slice(colon + 1)) : "";
  return { user, password, host: authority.host, port: authority.port };
}

function parseSs(raw: string, sourceFormat: SourceFormat): NormalizedNode | ParseIssue {
  const parts = splitUri(raw, "ss://");
  let method: string | undefined;
  let password: string | undefined;
  let host: string | undefined;
  let port: number | undefined;

  if (parts.main.includes("@")) {
    const at = parts.main.lastIndexOf("@");
    const userinfo = parts.main.slice(0, at);
    const authority = parseHostPort(parts.main.slice(at + 1));
    if (!authority) return { code: "MALFORMED_URI", protocol: "ss" };
    host = authority.host;
    port = authority.port;
    const decoded = decodeBase64Utf8(userinfo);
    const material = decoded ?? safeDecodeURIComponent(userinfo);
    const colon = material.indexOf(":");
    if (colon <= 0) return { code: "INVALID_NODE", protocol: "ss" };
    method = material.slice(0, colon);
    password = material.slice(colon + 1);
  } else {
    const decoded = decodeBase64Utf8(parts.main);
    if (!decoded) return { code: "MALFORMED_URI", protocol: "ss" };
    const at = decoded.lastIndexOf("@");
    if (at <= 0) return { code: "MALFORMED_URI", protocol: "ss" };
    const userinfo = decoded.slice(0, at);
    const authority = parseHostPort(decoded.slice(at + 1));
    if (!authority) return { code: "MALFORMED_URI", protocol: "ss" };
    const colon = userinfo.indexOf(":");
    if (colon <= 0) return { code: "INVALID_NODE", protocol: "ss" };
    method = userinfo.slice(0, colon);
    password = userinfo.slice(colon + 1);
    host = authority.host;
    port = authority.port;
  }

  if (!method || !password || !host || port == null) {
    return { code: "INVALID_NODE", protocol: "ss" };
  }

  const name = nodeName(parts.name, "ss", host, port);
  const plugin = asString(parts.query.get("plugin") ?? undefined);
  return normalized({
    name,
    protocol: "ss",
    server: host,
    port,
    sourceFormat,
    network: plugin,
    identity: `${method}\0${password}`,
    rawConfig: {
      name,
      type: "ss",
      server: host,
      port,
      cipher: method,
      password,
      plugin,
    },
  });
}

function parseVmess(raw: string, sourceFormat: SourceFormat): NormalizedNode | ParseIssue {
  const parts = splitUri(raw, "vmess://");
  const decoded = decodeBase64Utf8(parts.main);
  if (!decoded) return { code: "MALFORMED_URI", protocol: "vmess" };

  let payload: unknown;
  try {
    payload = JSON.parse(decoded);
  } catch {
    return { code: "MALFORMED_URI", protocol: "vmess" };
  }
  if (!payload || typeof payload !== "object") {
    return { code: "MALFORMED_URI", protocol: "vmess" };
  }

  const record = payload as Record<string, unknown>;
  const server = asString(record.add) ?? asString(record.server);
  const port = asPort(record.port);
  const uuid = asString(record.id) ?? asString(record.uuid);
  if (!server || port == null || !uuid || isUnsafeServer(server)) {
    return { code: "INVALID_NODE", protocol: "vmess" };
  }

  const name = nodeName(
    parts.name || asString(record.ps) || "",
    "vmess",
    server,
    port
  );
  const network = (asString(record.net) ?? "tcp").toLowerCase();
  const security = (asString(record.tls) ?? "").toLowerCase() || undefined;
  return normalized({
    name,
    protocol: "vmess",
    server,
    port,
    sourceFormat,
    network,
    security,
    identity: uuid,
    rawConfig: {
      name,
      type: "vmess",
      server,
      port,
      uuid,
      alterId: asPort(record.aid) ?? 0,
      cipher: asString(record.scy) ?? "auto",
      network,
      tls: security === "tls",
      servername: asString(record.sni) ?? asString(record.host),
      "ws-opts":
        network === "ws"
          ? { path: asString(record.path), headers: { Host: asString(record.host) } }
          : undefined,
    },
  });
}

function parseTrojan(raw: string, sourceFormat: SourceFormat): NormalizedNode | ParseIssue {
  const parts = splitUri(raw, "trojan://");
  const parsed = parseUserHost(parts.main);
  const password = parsed ? parsed.password || parsed.user : "";
  if (!parsed || !password) {
    return { code: "INVALID_NODE", protocol: "trojan" };
  }

  const name = nodeName(parts.name, "trojan", parsed.host, parsed.port);
  const network = (asString(parts.query.get("type") ?? undefined) ?? "tcp").toLowerCase();
  const security =
    (asString(parts.query.get("security") ?? undefined) ?? "tls").toLowerCase();
  const sni = asString(parts.query.get("sni") ?? undefined);
  return normalized({
    name,
    protocol: "trojan",
    server: parsed.host,
    port: parsed.port,
    sourceFormat,
    network,
    security,
    identity: password,
    rawConfig: {
      name,
      type: "trojan",
      server: parsed.host,
      port: parsed.port,
      password,
      sni,
      network,
      tls: security === "tls",
    },
  });
}

function parseVless(raw: string, sourceFormat: SourceFormat): NormalizedNode | ParseIssue {
  const parts = splitUri(raw, "vless://");
  const parsed = parseUserHost(parts.main);
  if (!parsed || !parsed.user) {
    return { code: "INVALID_NODE", protocol: "vless" };
  }

  const name = nodeName(parts.name, "vless", parsed.host, parsed.port);
  const network = (asString(parts.query.get("type") ?? undefined) ?? "tcp").toLowerCase();
  const security = (asString(parts.query.get("security") ?? undefined) ?? "none").toLowerCase();
  const sni = asString(parts.query.get("sni") ?? undefined);
  const flow = asString(parts.query.get("flow") ?? undefined);
  const path = asString(parts.query.get("path") ?? undefined);
  const hostHeader = asString(parts.query.get("host") ?? undefined);
  return normalized({
    name,
    protocol: "vless",
    server: parsed.host,
    port: parsed.port,
    sourceFormat,
    network,
    security: security === "none" ? undefined : security,
    identity: parsed.user,
    rawConfig: {
      name,
      type: "vless",
      server: parsed.host,
      port: parsed.port,
      uuid: parsed.user,
      network,
      tls: security === "tls" || security === "reality",
      servername: sni,
      flow,
      "ws-opts":
        network === "ws" ? { path, headers: { Host: hostHeader } } : undefined,
    },
  });
}

export function looksLikeProxyUri(line: string) {
  return URI_SCHEME.test(line.trim());
}

export function parseProxyUri(
  line: string,
  sourceFormat: SourceFormat = "uri"
): NormalizedNode | ParseIssue {
  const trimmed = line.trim();
  const match = trimmed.match(URI_SCHEME);
  if (!match) {
    return { code: "MALFORMED_URI" };
  }

  const scheme = match[1].toLowerCase();
  if (UNSUPPORTED_SCHEMES.has(scheme) || scheme === "socks5") {
    return { code: "UNSUPPORTED_PROTOCOL", protocol: scheme };
  }

  try {
    if (scheme === "ss") return parseSs(trimmed, sourceFormat);
    if (scheme === "vmess") return parseVmess(trimmed, sourceFormat);
    if (scheme === "trojan") return parseTrojan(trimmed, sourceFormat);
    if (scheme === "vless") return parseVless(trimmed, sourceFormat);
    return { code: "UNSUPPORTED_PROTOCOL", protocol: scheme };
  } catch {
    return { code: "MALFORMED_URI", protocol: scheme };
  }
}

export function parseUriList(text: string, sourceFormat: SourceFormat = "uri-list") {
  const nodes: NormalizedNode[] = [];
  const unsupported: ParseIssue[] = [];
  const invalid: ParseIssue[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const parsed = parseProxyUri(line, sourceFormat);
    if ("protocol" in parsed && "server" in parsed && "rawConfig" in parsed) {
      nodes.push(parsed);
      continue;
    }
    const issue = parsed as ParseIssue;
    if (issue.code === "UNSUPPORTED_PROTOCOL") unsupported.push(issue);
    else invalid.push(issue);
  }

  return { nodes, unsupported, invalid };
}
