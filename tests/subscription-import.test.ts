import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { getPrisma, pingDatabase, resetPrismaForTests } from "../lib/prisma";
import { parseAndImportAirportNodes } from "../lib/subscription/import-nodes";

const SS_PASSWORD = "fake-ss-password-9f3c";
const suffix = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
const airportId = `test3b1_ap_${suffix}`;
const demoNodeId = `test3b1_demo_${suffix}`;

function yamlNodes(names: string[]) {
  return `proxies:
${names
  .map(
    (name, index) => `  - name: ${name}
    type: ss
    server: n${index}.example.invalid
    port: ${8388 + index}
    cipher: aes-256-gcm
    password: ${SS_PASSWORD}
`
  )
  .join("")}`;
}

before(async () => {
  resetPrismaForTests();
  const database = await pingDatabase();
  if (database !== "connected") {
    throw new Error("PostgreSQL is required for subscription import tests");
  }
  const prisma = getPrisma();
  await prisma.node.deleteMany({ where: { airportId } });
  await prisma.airport.deleteMany({ where: { id: airportId } });
  await prisma.airport.create({
    data: {
      id: airportId,
      name: "解析测试机场",
      slug: `test-3b1-${suffix}`,
      summary: "subscription import",
      status: "ACTIVE",
      isDemo: true,
    },
  });
  await prisma.node.create({
    data: {
      id: demoNodeId,
      airportId,
      name: "演示节点",
      region: "香港",
      kind: "中转",
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

test("同一订阅重复导入不会产生重复 Node", async () => {
  const content = yamlNodes([
    "香港 01",
    "日本 01",
    "美国 01",
    "台湾 01",
    "新加坡 01",
    "香港 02",
    "日本 02",
    "美国 02",
    "台湾 02",
    "新加坡 02",
  ]);
  const first = await parseAndImportAirportNodes(airportId, content);
  assert.equal(first.parsedCount, 10);
  assert.equal(first.createdCount, 10);
  assert.equal(first.updatedCount, 0);

  const second = await parseAndImportAirportNodes(airportId, content);
  assert.equal(second.parsedCount, 10);
  assert.equal(second.createdCount, 0);
  assert.equal(second.updatedCount, 10);
  assert.deepEqual(
    second.nodes.map((node) => node.id).sort(),
    first.nodes.map((node) => node.id).sort()
  );

  const prisma = getPrisma();
  const count = await prisma.node.count({
    where: { airportId, fingerprint: { not: null } },
  });
  assert.equal(count, 10);
});

test("消失 Node 会失活而不是物理删除", async () => {
  const full = yamlNodes(["香港 01", "日本 01", "美国 01"]);
  const first = await parseAndImportAirportNodes(airportId, full);
  const droppedName = "美国 01";
  const dropped = first.nodes.find((node) => node.name === droppedName);
  assert.ok(dropped);

  const remaining = await parseAndImportAirportNodes(
    airportId,
    yamlNodes(["香港 01", "日本 01"])
  );
  assert.equal(remaining.deactivatedCount >= 1, true);
  assert.equal(remaining.nodes.some((node) => node.name === droppedName), false);

  const prisma = getPrisma();
  const paused = await prisma.node.findUnique({ where: { id: dropped.id } });
  assert.ok(paused);
  assert.equal(paused.status, "PAUSED");
  assert.equal(paused.name, droppedName);

  const demo = await prisma.node.findUnique({ where: { id: demoNodeId } });
  assert.ok(demo);
  assert.equal(demo.status, "ACTIVE");
  assert.equal(demo.fingerprint, null);

  const revived = await parseAndImportAirportNodes(airportId, full);
  const activeAgain = revived.nodes.find((node) => node.name === droppedName);
  assert.ok(activeAgain);
  assert.equal(activeAgain.id, dropped.id);
  assert.equal(activeAgain.status, "ACTIVE");
});
