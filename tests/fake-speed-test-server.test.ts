import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { afterEach, test } from "node:test";
import { LOCALHOST } from "../lib/proxy-runtime/constants";
import {
  FAKE_DIRECT_IP,
  FAKE_SERVER_ID,
  FakeSpeedTestServer,
} from "./helpers/fake-speed-test-server";
import { directGet, parseJsonBody } from "./helpers/via-proxy-http";

const servers: FakeSpeedTestServer[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.stop()));
});

function track(server: FakeSpeedTestServer) {
  servers.push(server);
  return server;
}

async function canBind(port: number) {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, LOCALHOST, () => resolve());
  });
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

test("FakeSpeedTestServer 启动在 localhost 随机端口，/health 返回 isDemo", async () => {
  const server = track(new FakeSpeedTestServer());
  const address = await server.start();
  assert.equal(server.isDemo, true);
  assert.match(address, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.notEqual(server.portNumber, 0);
  const health = await directGet(`${address}/health`);
  assert.equal(health.statusCode, 200);
  const body = parseJsonBody<{ ok: boolean; isDemo: boolean; region: string }>(health.body);
  assert.equal(body.ok, true);
  assert.equal(body.isDemo, true);
  assert.equal(body.region, "fixture");
});

test("FakeSpeedTestServer 关闭后释放端口，重复 stop 不报错", async () => {
  const server = track(new FakeSpeedTestServer());
  await server.start();
  const port = server.portNumber;
  assert.ok(port != null);
  await server.stop();
  await server.stop();
  assert.equal(server.address, null);
  await canBind(port);
});

test("whoami 直连返回 fixture identity，伪造 IP 头不会变成 proxied", async () => {
  const server = track(new FakeSpeedTestServer());
  const address = await server.start();
  const whoami = await directGet(`${address}/speedtest/whoami`, 2000, {
    "x-forwarded-for": "8.8.8.8",
    "x-real-ip": "1.1.1.1",
  });
  const body = parseJsonBody<{
    isDemo: boolean;
    fixture: boolean;
    serverId: string;
    observedSourceIp: string;
    path: string;
    via: string | null;
  }>(whoami.body);
  assert.equal(body.isDemo, true);
  assert.equal(body.fixture, true);
  assert.equal(body.serverId, FAKE_SERVER_ID);
  assert.equal(body.observedSourceIp, FAKE_DIRECT_IP);
  assert.equal(body.path, "direct");
  assert.equal(body.via, null);
});

test("ping / download / upload 在 localhost 上返回确定性数据", async () => {
  const server = track(new FakeSpeedTestServer());
  const address = await server.start();
  const ping = await directGet(`${address}/speedtest/ping`);
  assert.equal(ping.statusCode, 200);
  assert.equal(parseJsonBody<{ isDemo: true }>(ping.body).isDemo, true);

  const download = await new Promise<{ status: number; bytes: number }>((resolve, reject) => {
    http
      .get(`${address}/speedtest/download?size=2048`, (res) => {
        let bytes = 0;
        res.on("data", (chunk) => {
          bytes += (chunk as Buffer).length;
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, bytes }));
      })
      .on("error", reject);
  });
  assert.equal(download.status, 200);
  assert.equal(download.bytes, 2048);

  const uploaded = await new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = http.request(
      `${address}/speedtest/upload`,
      { method: "POST", headers: { "content-length": 16 } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk as Buffer));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") })
        );
      }
    );
    req.on("error", reject);
    req.end(Buffer.alloc(16));
  });
  assert.equal(uploaded.status, 200);
  assert.equal(parseJsonBody<{ bytes: number; isDemo: true }>(uploaded.body).bytes, 16);
  assert.equal(server.bytesDiscarded(), 16);
});

test("query fail=1 返回 SERVER_ERROR，且仍是 isDemo", async () => {
  const server = track(new FakeSpeedTestServer());
  const address = await server.start();
  const ping = await directGet(`${address}/speedtest/ping?fail=1`);
  assert.equal(ping.statusCode, 500);
  assert.equal(parseJsonBody<{ isDemo: true; error: string }>(ping.body).error, "SERVER_ERROR");
});
