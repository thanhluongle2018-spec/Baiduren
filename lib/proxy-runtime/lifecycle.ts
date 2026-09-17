import type { ProxyRuntimeState } from "@/lib/proxy-runtime/types";

const ALLOWED: Record<ProxyRuntimeState, ProxyRuntimeState[]> = {
  CREATED: ["STARTING", "STOPPED"],
  STARTING: ["RUNNING", "FAILED"],
  RUNNING: ["STOPPING", "FAILED"],
  STOPPING: ["STOPPED", "FAILED"],
  FAILED: ["STOPPING", "STOPPED"],
  STOPPED: ["STOPPED"],
};

export function canTransitionRuntime(
  from: ProxyRuntimeState,
  to: ProxyRuntimeState
) {
  return ALLOWED[from].includes(to);
}

export function assertRuntimeTransition(
  from: ProxyRuntimeState,
  to: ProxyRuntimeState
) {
  if (!canTransitionRuntime(from, to)) {
    throw new Error(`illegal runtime transition ${from} → ${to}`);
  }
}
