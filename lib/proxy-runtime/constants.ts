export const STARTUP_TIMEOUT_MS = 8_000;
export const HEALTHCHECK_TIMEOUT_MS = 3_000;
export const REQUEST_TIMEOUT_MS = 5_000;
export const SHUTDOWN_TIMEOUT_MS = 3_000;

export const LOCALHOST = "127.0.0.1" as const;

export const MIHOMO_BINARY_ENV = "BAIDUREN_MIHOMO_BIN";

export const RUNTIME_PROTOCOLS = [
  "ss",
  "vmess",
  "vless",
  "trojan",
  "socks5",
  "http",
] as const;

export type RuntimeProtocol = (typeof RUNTIME_PROTOCOLS)[number];
