import { hashSpeedTestIdentity } from "@/lib/speedtest/raw-metrics";
import type { ProxyRuntimeKind } from "@/lib/proxy-runtime/types";

export type ObservedIdentity = {
  observedSourceIp: string;
  path: string;
  fixture: boolean;
  isDemo: boolean;
  via: string | null;
};

export type ExitVerification = {
  orchestrationOk: boolean;
  exitVerified: false;
  provenance: "demo-fixture" | "unproven" | "blocked-real";
  reason: "EXIT_IP_UNVERIFIED" | null;
  directIdentityHash: string | null;
  proxiedIdentityHash: string | null;
  identitiesAreFixture: boolean;
};

/**
 * C1 production gate. Real (isDemo=false) results are impossible while this is false.
 * Opening it requires a later phase: real Mihomo + real SpeedTestServer + verified exit.
 */
export const REAL_PRODUCTION_GATE_OPEN = false as const;

export function parseObservedIdentity(body: unknown): ObservedIdentity | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const ip = typeof record.observedSourceIp === "string" ? record.observedSourceIp.trim() : "";
  if (!ip) return null;
  return {
    observedSourceIp: ip,
    path: typeof record.path === "string" ? record.path : "",
    fixture: record.fixture === true,
    isDemo: record.isDemo !== false,
    via: typeof record.via === "string" ? record.via : null,
  };
}

export function isPrivateOrDocumentationIp(ip: string) {
  const value = ip.trim().toLowerCase();
  if (value === "localhost" || value === "::1" || value === "0.0.0.0") return true;
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a == null || b == null) return true;
  if (a === 127) return true;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0 && parts[2] === 2) return true;
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  return false;
}

export function identitiesLookLikeFixture(direct: ObservedIdentity, proxied: ObservedIdentity) {
  return (
    direct.fixture ||
    proxied.fixture ||
    direct.isDemo ||
    proxied.isDemo ||
    direct.path.includes("fixture") ||
    proxied.path.includes("fixture") ||
    isPrivateOrDocumentationIp(direct.observedSourceIp) ||
    isPrivateOrDocumentationIp(proxied.observedSourceIp)
  );
}

/**
 * Structural + safety check. Fake identities may pass orchestration (different IPs)
 * but never count as a verified real exit. C1 cannot set exitVerified=true.
 */
export function verifyExitIdentity(
  direct: ObservedIdentity | null,
  proxied: ObservedIdentity | null,
  context: { runtimeKind: ProxyRuntimeKind }
): ExitVerification {
  const directHash = direct ? hashSpeedTestIdentity(`direct:${direct.observedSourceIp}`) : null;
  const proxiedHash = proxied ? hashSpeedTestIdentity(`proxied:${proxied.observedSourceIp}`) : null;

  if (!direct || !proxied) {
    return {
      orchestrationOk: false,
      exitVerified: false,
      provenance: "unproven",
      reason: "EXIT_IP_UNVERIFIED",
      directIdentityHash: directHash,
      proxiedIdentityHash: proxiedHash,
      identitiesAreFixture: true,
    };
  }

  if (direct.observedSourceIp === proxied.observedSourceIp) {
    return {
      orchestrationOk: false,
      exitVerified: false,
      provenance: identitiesLookLikeFixture(direct, proxied) ? "demo-fixture" : "unproven",
      reason: "EXIT_IP_UNVERIFIED",
      directIdentityHash: directHash,
      proxiedIdentityHash: proxiedHash,
      identitiesAreFixture: identitiesLookLikeFixture(direct, proxied),
    };
  }

  const fixture = identitiesLookLikeFixture(direct, proxied);
  const realProof =
    REAL_PRODUCTION_GATE_OPEN &&
    context.runtimeKind === "mihomo" &&
    !fixture &&
    !direct.isDemo &&
    !proxied.isDemo;

  return {
    orchestrationOk: true,
    exitVerified: false,
    provenance: fixture ? "demo-fixture" : realProof ? "blocked-real" : "unproven",
    reason: null,
    directIdentityHash: directHash,
    proxiedIdentityHash: proxiedHash,
    identitiesAreFixture: fixture,
  };
}

export function allowRealSpeedTestResult(_input: {
  executorKind: "real";
  runtimeKind: ProxyRuntimeKind | null;
  exitVerified: boolean;
  identitiesAreFixture: boolean;
}): false {
  void _input;
  return REAL_PRODUCTION_GATE_OPEN;
}
