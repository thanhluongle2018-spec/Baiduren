import {
  SUPPORTED_PROTOCOLS,
  type SupportedProtocol,
} from "@/lib/subscription/types";

export function isSupportedProtocol(value: string): value is SupportedProtocol {
  return (SUPPORTED_PROTOCOLS as readonly string[]).includes(value);
}

export function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

export function asPort(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value >= 1 && value <= 65535 ? value : undefined;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535) {
      return parsed;
    }
  }
  return undefined;
}

export function isUnsafeServer(server: string) {
  const value = server.trim().toLowerCase();
  if (!value) return true;
  if (value.startsWith("file:")) return true;
  if (value.startsWith("/") || value.startsWith("\\\\")) return true;
  if (/^[a-z]:[\\/]/i.test(server.trim())) return true;
  return false;
}

export function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function decodeBase64Utf8(value: string): string | null {
  const compact = value.replace(/\s+/g, "");
  if (!compact) return null;
  const padded = compact.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = padded.length % 4;
  const withPad =
    remainder === 0 ? padded : `${padded}${"=".repeat(4 - remainder)}`;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(withPad)) return null;
  try {
    const buffer = Buffer.from(withPad, "base64");
    if (buffer.length === 0) return null;
    return buffer.toString("utf8");
  } catch {
    return null;
  }
}

export function parseHostPort(authority: string): { host: string; port: number } | null {
  const value = authority.trim();
  if (!value) return null;

  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    if (end <= 1) return null;
    const host = value.slice(1, end);
    if (!value.slice(end + 1).startsWith(":")) return null;
    const port = asPort(value.slice(end + 2));
    if (!host || port == null || isUnsafeServer(host)) return null;
    return { host, port };
  }

  const colon = value.lastIndexOf(":");
  if (colon <= 0) return null;
  const host = value.slice(0, colon).trim();
  const port = asPort(value.slice(colon + 1));
  if (!host || port == null || isUnsafeServer(host)) return null;
  return { host, port };
}

export function inferKind(name: string) {
  if (/中转|relay/i.test(name)) return "中转";
  return "直连";
}

export function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return { ...value };
}
