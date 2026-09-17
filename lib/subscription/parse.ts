import { looksLikeClashYaml, parseClashYaml } from "@/lib/subscription/clash-yaml";
import { isSubscriptionError, SubscriptionError } from "@/lib/subscription/errors";
import { decodeBase64Utf8 } from "@/lib/subscription/helpers";
import { looksLikeProxyUri, parseUriList } from "@/lib/subscription/uri";
import {
  MAX_SUBSCRIPTION_BYTES,
  type ParseResult,
  type SourceFormat,
} from "@/lib/subscription/types";

function significantLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function looksLikeUriList(text: string) {
  return significantLines(text).some((line) => looksLikeProxyUri(line));
}

function uriSourceFormat(text: string): SourceFormat {
  return significantLines(text).length > 1 ? "uri-list" : "uri";
}

function tryDecodeSubscriptionBase64(text: string): string | null {
  const compact = text.replace(/\s+/g, "");
  if (compact.length < 24) return null;
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(compact)) return null;
  const decoded = decodeBase64Utf8(compact);
  if (!decoded || decoded.includes("\u0000")) return null;
  const trimmed = decoded.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return null;
  if (looksLikeClashYaml(trimmed) || looksLikeUriList(trimmed)) return trimmed;
  return null;
}

function parseDecoded(text: string): ParseResult {
  if (looksLikeUriList(text)) {
    return parseUriList(text, uriSourceFormat(text));
  }
  if (looksLikeClashYaml(text)) {
    return parseClashYaml(text);
  }
  try {
    return parseClashYaml(text);
  } catch (error) {
    if (isSubscriptionError(error) && looksLikeClashYaml(text)) throw error;
    return {
      nodes: [],
      unsupported: [],
      invalid: [{ code: "INVALID_NODE" }],
    };
  }
}

export function parseSubscriptionContent(content: string): ParseResult {
  if (typeof content !== "string") {
    throw new SubscriptionError("CONTENT_REQUIRED");
  }
  if (Buffer.byteLength(content, "utf8") > MAX_SUBSCRIPTION_BYTES) {
    throw new SubscriptionError("CONTENT_TOO_LARGE");
  }

  const trimmed = content.replace(/^\uFEFF/, "").trim();
  if (!trimmed) {
    throw new SubscriptionError("CONTENT_REQUIRED");
  }

  if (looksLikeUriList(trimmed)) {
    return parseUriList(trimmed, uriSourceFormat(trimmed));
  }
  if (looksLikeClashYaml(trimmed)) {
    return parseClashYaml(trimmed);
  }

  const decoded = tryDecodeSubscriptionBase64(trimmed);
  if (decoded) {
    if (Buffer.byteLength(decoded, "utf8") > MAX_SUBSCRIPTION_BYTES) {
      throw new SubscriptionError("CONTENT_TOO_LARGE");
    }
    return parseDecoded(decoded);
  }

  return parseDecoded(trimmed);
}
