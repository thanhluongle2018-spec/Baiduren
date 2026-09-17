import http from "node:http";
import { LOCALHOST } from "@/lib/proxy-runtime/constants";
import { VIA_HEADER } from "@/lib/proxy-runtime/fake-runtime";

export type FixtureRequest = {
  via: string | null;
  url: string;
  remoteAddress: string | null;
};

export function startProbeFixture() {
  const requests: FixtureRequest[] = [];
  const server = http.createServer((req, res) => {
    const viaHeader = req.headers[VIA_HEADER];
    const via = Array.isArray(viaHeader) ? viaHeader[0] : viaHeader ?? null;
    requests.push({
      via,
      url: req.url ?? "",
      remoteAddress: req.socket.remoteAddress ?? null,
    });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, via }));
  });

  const ready = new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, LOCALHOST, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve(port);
    });
  });

  return {
    requests,
    async url() {
      const port = await ready;
      return `http://${LOCALHOST}:${port}/probe`;
    },
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
