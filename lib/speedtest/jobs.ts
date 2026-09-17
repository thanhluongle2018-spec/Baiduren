import type { PrismaClient } from "@/lib/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import {
  DEFAULT_CONCURRENCY,
  MAX_CONCURRENCY,
  MIN_CONCURRENCY,
} from "@/lib/speedtest/constants";
import { SpeedTestJobError } from "@/lib/speedtest/errors";
import type { CreateSpeedTestJobInput } from "@/lib/speedtest/types";

function parseConcurrency(value: number | undefined) {
  const concurrency = value ?? DEFAULT_CONCURRENCY;
  if (
    !Number.isInteger(concurrency) ||
    concurrency < MIN_CONCURRENCY ||
    concurrency > MAX_CONCURRENCY
  ) {
    throw new SpeedTestJobError("INVALID_CONCURRENCY");
  }
  return concurrency;
}

export async function createSpeedTestJob(
  input: CreateSpeedTestJobInput,
  prisma: PrismaClient = getPrisma()
) {
  const concurrency = parseConcurrency(input.concurrency);
  const isDemo = input.isDemo !== false;

  try {
    const [airport, node, server] = await Promise.all([
      prisma.airport.findUnique({ where: { id: input.airportId } }),
      prisma.node.findUnique({ where: { id: input.nodeId } }),
      prisma.speedTestServer.findUnique({
        where: { id: input.speedTestServerId },
      }),
    ]);

    if (!airport) throw new SpeedTestJobError("AIRPORT_NOT_FOUND");
    if (!node) throw new SpeedTestJobError("NODE_NOT_FOUND");
    if (node.airportId !== airport.id) {
      throw new SpeedTestJobError("NODE_AIRPORT_MISMATCH");
    }
    if (!server) throw new SpeedTestJobError("SERVER_NOT_FOUND");
    if (server.status !== "ACTIVE") {
      throw new SpeedTestJobError("SERVER_DISABLED");
    }

    const job = await prisma.speedTest.create({
      data: {
        airportId: airport.id,
        nodeId: node.id,
        serverId: server.id,
        status: "PENDING",
        mode: concurrency > 1 ? "MULTI_THREAD" : "SINGLE_THREAD",
        concurrency,
        region: server.region,
        isDemo,
      },
      include: {
        airport: { select: { name: true, slug: true, isDemo: true } },
        node: { select: { name: true } },
        server: {
          select: { id: true, name: true, region: true, status: true, isDemo: true },
        },
      },
    });

    return job;
  } catch (error) {
    if (error instanceof SpeedTestJobError) throw error;
    throw new SpeedTestJobError("DATABASE_UNAVAILABLE");
  }
}
