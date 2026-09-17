import net from "node:net";
import { LOCALHOST } from "@/lib/proxy-runtime/constants";
import { ProxyRuntimeError } from "@/lib/proxy-runtime/errors";

export async function allocateLocalhostPort(): Promise<number> {
  const server = net.createServer();
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, LOCALHOST, () => resolve());
    });
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    if (!port) throw new ProxyRuntimeError("PORT_UNAVAILABLE");
    return port;
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

export function isLocalhost(host: string) {
  const value = host.trim().toLowerCase();
  return value === "127.0.0.1" || value === "localhost";
}

export async function tcpHealthy(
  host: string,
  port: number,
  timeoutMs: number
): Promise<boolean> {
  if (!isLocalhost(host)) return false;
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.end();
      resolve(true);
    });
    socket.once("error", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(false);
    });
  });
}
