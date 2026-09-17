#!/usr/bin/env node
/**
 * Test stub that mimics a subset of Mihomo CLI: read -f config.yaml,
 * bind mixed-port on 127.0.0.1 as an HTTP forward proxy. Not a real core.
 */
import http from "node:http";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

const mode = process.env.BAIDUREN_STUB_MODE ?? "listen";
if (mode === "crash") {
  process.exit(1);
}
if (mode === "hang") {
  setInterval(() => undefined, 60_000);
} else {
  const flagIndex = process.argv.indexOf("-f");
  const configPath = flagIndex >= 0 ? process.argv[flagIndex + 1] : "";
  if (!configPath) process.exit(2);
  const document = parse(readFileSync(configPath, "utf8"));
  const mixedPort = Number(document?.["mixed-port"]);
  const bind = String(document?.["bind-address"] ?? "127.0.0.1");
  if (!Number.isInteger(mixedPort) || mixedPort <= 0) process.exit(3);
  if (bind !== "127.0.0.1") process.exit(4);

  const server = http.createServer((req, res) => {
    try {
      const target = new URL(req.url ?? "");
      if (target.hostname !== "127.0.0.1" && target.hostname !== "localhost") {
        res.writeHead(403).end();
        return;
      }
      const headers = {
        ...req.headers,
        "x-baiduren-via": "mihomo-stub",
        host: target.host,
      };
      const upstream = http.request(
        {
          hostname: target.hostname,
          port: target.port || 80,
          path: `${target.pathname}${target.search}`,
          method: req.method,
          headers,
        },
        (up) => {
          res.writeHead(up.statusCode ?? 502, up.headers);
          up.pipe(res);
        }
      );
      upstream.on("error", () => {
        if (!res.headersSent) res.writeHead(502);
        res.end();
      });
      req.pipe(upstream);
    } catch {
      res.writeHead(400).end();
    }
  });
  server.listen(mixedPort, bind);
}
