import { createHash } from "node:crypto";
import type { NormalizedNode } from "@/lib/subscription/types";

function identityMaterial(node: NormalizedNode) {
  const identity = node.metadata.identity ?? "";
  const network = node.metadata.network ?? "";
  const security = node.metadata.security ?? "";
  const identityHash = identity
    ? createHash("sha256").update(identity).digest("hex")
    : "";
  return [identityHash, network, security].join("|");
}

/**
 * Stable per-airport node identity. Secrets are hashed into the preimage
 * and never stored as plaintext on Node.fingerprint.
 */
export function nodeFingerprint(airportId: string, node: NormalizedNode) {
  const material = [
    airportId,
    node.protocol,
    node.server.trim().toLowerCase(),
    String(node.port),
    identityMaterial(node),
  ].join("\0");
  return createHash("sha256").update(material).digest("hex");
}
