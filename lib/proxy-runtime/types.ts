export type ProxyRuntimeState =
  | "CREATED"
  | "STARTING"
  | "RUNNING"
  | "STOPPING"
  | "STOPPED"
  | "FAILED";

export type ProxyRuntimeKind = "mihomo" | "fake";

export type ProxyEndpoint = {
  host: "127.0.0.1";
  port: number;
  scheme: "http";
  url: string;
};

export type RuntimeNodeInput = {
  name: string;
  protocol: string;
  server: string;
  port: number;
  rawConfig?: Record<string, unknown> | string | null;
};

export type ConnectivityProbeResult = {
  success: boolean;
  latencyMs: number | null;
  errorCode: string | null;
  sanitizedError: string | null;
  viaProxy: boolean;
  viaToken: string | null;
  statusCode: number | null;
};

export interface ProxyRuntime {
  readonly kind: ProxyRuntimeKind;
  readonly id: string;
  state(): ProxyRuntimeState;
  start(): Promise<ProxyEndpoint>;
  stop(): Promise<void>;
  getProxyEndpoint(): ProxyEndpoint | null;
  healthCheck(): Promise<boolean>;
}
