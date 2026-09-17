import "dotenv/config";
import { runWorkerLoop } from "../lib/speedtest/worker";

/**
 * Independent Worker process.
 * Claims PENDING demo jobs from PostgreSQL and runs the mock executor.
 * Never probes real airports, proxies, or public networks.
 */
async function main() {
  const signal = new AbortController();
  const stop = () => signal.abort();
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  console.log("baiduren mock speedtest worker started");
  await runWorkerLoop({ signal: signal.signal });
}

main().catch((error) => {
  console.error("worker stopped");
  if (error instanceof Error) {
    console.error(error.message);
  }
  process.exit(1);
});
