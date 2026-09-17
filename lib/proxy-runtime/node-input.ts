import { asPort, asString } from "@/lib/subscription/helpers";
import { RUNTIME_PROTOCOLS } from "@/lib/proxy-runtime/constants";
import { ProxyRuntimeError } from "@/lib/proxy-runtime/errors";
import type { RuntimeNodeInput } from "@/lib/proxy-runtime/types";

function parseRawConfig(raw: RuntimeNodeInput["rawConfig"]): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      throw new ProxyRuntimeError("INVALID_NODE");
    }
    throw new ProxyRuntimeError("INVALID_NODE");
  }
  return { ...raw };
}

export function resolveRuntimeProtocol(node: RuntimeNodeInput) {
  const raw = parseRawConfig(node.rawConfig);
  const originalType = (asString(raw.type) ?? node.protocol).toLowerCase();
  if (originalType === "https") return "http";
  if (originalType === "socks") return "socks5";
  if (originalType === "shadowsocks") return "ss";
  if (!(RUNTIME_PROTOCOLS as readonly string[]).includes(originalType)) {
    throw new ProxyRuntimeError("UNSUPPORTED_PROTOCOL");
  }
  return originalType;
}

export function loadRuntimeNode(node: RuntimeNodeInput) {
  const protocol = resolveRuntimeProtocol(node);
  const raw = parseRawConfig(node.rawConfig);
  const server = asString(raw.server) ?? node.server;
  const port = asPort(raw.port) ?? node.port;
  const name = asString(raw.name) ?? node.name;
  if (!server || !port || !name) {
    throw new ProxyRuntimeError("INVALID_NODE");
  }
  return { protocol, raw, server, port, name };
}

export function httpUsesTls(raw: Record<string, unknown>, protocol: string) {
  if (protocol !== "http") return false;
  if (raw.tls === true || asString(raw.tls) === "tls") return true;
  return (asString(raw.type) ?? "").toLowerCase() === "https";
}
