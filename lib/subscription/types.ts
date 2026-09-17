export const SUPPORTED_PROTOCOLS = [
  "ss",
  "vmess",
  "trojan",
  "vless",
  "socks5",
  "http",
] as const;

export type SupportedProtocol = (typeof SUPPORTED_PROTOCOLS)[number];

export type SourceFormat = "clash-yaml" | "uri" | "uri-list";

export type RegionHint = "HK" | "JP" | "US" | "TW" | "SG" | "UNKNOWN";

export type NormalizedNode = {
  name: string;
  protocol: SupportedProtocol;
  server: string;
  port: number;
  regionHint: RegionHint;
  rawConfig: Record<string, unknown>;
  sourceFormat: SourceFormat;
  metadata: {
    network?: string;
    security?: string;
    identity?: string;
  };
};

export type ParseIssueCode =
  | "UNSUPPORTED_PROTOCOL"
  | "INVALID_NODE"
  | "MALFORMED_URI"
  | "INVALID_YAML"
  | "EMPTY_CONTENT"
  | "CONTENT_TOO_LARGE";

export type ParseIssue = {
  code: ParseIssueCode;
  protocol?: string;
  name?: string;
};

export type ParseResult = {
  nodes: NormalizedNode[];
  unsupported: ParseIssue[];
  invalid: ParseIssue[];
};

export type NodeSummary = {
  id: string;
  name: string;
  protocol: string | null;
  server: string | null;
  port: number | null;
  regionHint: string | null;
  status: string;
};

export const MAX_SUBSCRIPTION_BYTES = 512 * 1024;
