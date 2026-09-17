import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { GET as getAirport } from "../app/api/airports/[slug]/route";
import { POST as parseNodes } from "../app/api/airports/[slug]/nodes/parse/route";
import { getPrisma, pingDatabase, resetPrismaForTests } from "../lib/prisma";
import { SubscriptionError } from "../lib/subscription/errors";
import { parseSubscriptionContent } from "../lib/subscription/parse";
import { containsSecret } from "../lib/subscription/secrets";
import { MAX_SUBSCRIPTION_BYTES } from "../lib/subscription/types";

const SS_PASSWORD = "fake-ss-password-9f3c";
const VMESS_UUID = "11111111-aaaa-bbbb-cccc-111111111111";
const suffix = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
const airportId = `test3b1sec_ap_${suffix}`;
const slug = `test-3b1-sec-${suffix}`;

const yaml = `proxies:
  - name: 香港 01
    type: ss
    server: hk.example.invalid
    port: 8388
    cipher: aes-256-gcm
    password: ${SS_PASSWORD}
  - name: 美国 01
    type: vmess
    server: us.example.invalid
    port: 443
    uuid: ${VMESS_UUID}
    alterId: 0
    cipher: auto
    network: tcp
`;

function secretsIn(value: string) {
  return containsSecret(value, [SS_PASSWORD, VMESS_UUID]);
}

before(async () => {
  resetPrismaForTests();
  const database = await pingDatabase();
  if (database !== "connected") {
    throw new Error("PostgreSQL is required for subscription security tests");
  }
  const prisma = getPrisma();
  await prisma.node.deleteMany({ where: { airportId } });
  await prisma.airport.deleteMany({ where: { id: airportId } });
  await prisma.airport.create({
    data: {
      id: airportId,
      name: "安全测试机场",
      slug,
      summary: "subscription security",
      status: "ACTIVE",
      isDemo: true,
    },
  });
});

after(async () => {
  const prisma = getPrisma();
  await prisma.node.deleteMany({ where: { airportId } });
  await prisma.airport.deleteMany({ where: { id: airportId } });
});

test("secret 不出现在错误信息", () => {
  try {
    parseSubscriptionContent(`proxies:
  - name: broken
    password: ${SS_PASSWORD}
    uuid: ${VMESS_UUID}
    type: [ss
`);
    assert.fail("expected INVALID_YAML");
  } catch (error) {
    assert.ok(error instanceof SubscriptionError);
    assert.equal(error.code, "INVALID_YAML");
    assert.equal(secretsIn(error.message), false);
    assert.equal(error.message.includes("ss://"), false);
  }
});

test("secret 不出现在普通 API 响应", async () => {
  const request = new Request("http://127.0.0.1/api/airports/x/nodes/parse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: yaml }),
  });
  const response = await parseNodes(request, {
    params: Promise.resolve({ slug }),
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  const serialized = JSON.stringify(payload);
  assert.equal(secretsIn(serialized), false);
  assert.equal(serialized.includes("rawConfig"), false);
  assert.equal("rawConfig" in payload.data.nodes[0], false);
  assert.equal(payload.data.parsedCount, 2);
  assert.equal(payload.data.nodes.length, 2);

  const prisma = getPrisma();
  const stored = await prisma.node.findFirst({
    where: { airportId, protocol: "ss" },
  });
  assert.ok(stored);
  assert.ok(stored.rawConfig);
  assert.equal(stored.rawConfig.includes(SS_PASSWORD), true);

  const publicResponse = await getAirport(request, {
    params: Promise.resolve({ slug }),
  });
  const publicPayload = await publicResponse.json();
  const publicSerialized = JSON.stringify(publicPayload);
  assert.equal(secretsIn(publicSerialized), false);
  assert.equal(publicSerialized.includes("rawConfig"), false);
});

test("超大输入被 API 拒绝且不回显内容", async () => {
  const content = `password: ${SS_PASSWORD}\n` + "a".repeat(MAX_SUBSCRIPTION_BYTES);
  const request = new Request("http://127.0.0.1/api/airports/x/nodes/parse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content }),
  });
  const response = await parseNodes(request, {
    params: Promise.resolve({ slug }),
  });
  assert.equal(response.status, 413);
  const payload = await response.json();
  assert.equal(secretsIn(JSON.stringify(payload)), false);
  assert.equal(payload.error, "订阅内容过大。");
});
