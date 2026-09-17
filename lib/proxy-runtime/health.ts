import { HEALTHCHECK_TIMEOUT_MS } from "@/lib/proxy-runtime/constants";
import { ProxyRuntimeError } from "@/lib/proxy-runtime/errors";
import type { ProxyRuntime } from "@/lib/proxy-runtime/types";

export async function healthCheckWithTimeout(
  runtime: ProxyRuntime,
  timeoutMs = HEALTHCHECK_TIMEOUT_MS
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      runtime.healthCheck(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new ProxyRuntimeError("HEALTHCHECK_TIMEOUT"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
