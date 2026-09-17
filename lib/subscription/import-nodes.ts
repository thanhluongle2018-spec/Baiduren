import type { PrismaClient } from "@/lib/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { SubscriptionError } from "@/lib/subscription/errors";
import { nodeFingerprint } from "@/lib/subscription/fingerprint";
import { inferKind } from "@/lib/subscription/helpers";
import { parseSubscriptionContent } from "@/lib/subscription/parse";
import { regionLabel } from "@/lib/subscription/region";
import type {
  NodeSummary,
  NormalizedNode,
  ParseIssue,
} from "@/lib/subscription/types";

export type ImportNodesResult = {
  airportId: string;
  airportSlug: string;
  airportIsDemo: boolean;
  parsedCount: number;
  unsupportedCount: number;
  invalidCount: number;
  createdCount: number;
  updatedCount: number;
  deactivatedCount: number;
  nodes: NodeSummary[];
  unsupported: ParseIssue[];
  invalid: ParseIssue[];
};

function uniqueByFingerprint(airportId: string, nodes: NormalizedNode[]) {
  const map = new Map<string, NormalizedNode>();
  for (const node of nodes) {
    map.set(nodeFingerprint(airportId, node), node);
  }
  return map;
}

function toSummary(node: {
  id: string;
  name: string;
  protocol: string | null;
  server: string | null;
  port: number | null;
  regionHint: string | null;
  status: string;
}): NodeSummary {
  return {
    id: node.id,
    name: node.name,
    protocol: node.protocol,
    server: node.server,
    port: node.port,
    regionHint: node.regionHint,
    status: node.status,
  };
}

export async function parseAndImportAirportNodes(
  airportKey: string,
  content: string,
  prisma: PrismaClient = getPrisma()
): Promise<ImportNodesResult> {
  const parsed = parseSubscriptionContent(content);

  let airport: { id: string; slug: string; isDemo: boolean } | null;
  try {
    airport = await prisma.airport.findFirst({
      where: { OR: [{ id: airportKey }, { slug: airportKey }] },
      select: { id: true, slug: true, isDemo: true },
    });
  } catch {
    throw new SubscriptionError("DATABASE_UNAVAILABLE");
  }

  if (!airport) {
    throw new SubscriptionError("AIRPORT_NOT_FOUND");
  }

  const uniqueNodes = uniqueByFingerprint(airport.id, parsed.nodes);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.node.findMany({
        where: { airportId: airport.id, fingerprint: { not: null } },
        select: {
          id: true,
          fingerprint: true,
        },
      });
      const existingByFingerprint = new Map(
        existing.map((row) => [row.fingerprint as string, row])
      );

      let createdCount = 0;
      let updatedCount = 0;
      const upsertedIds: string[] = [];

      for (const [fingerprint, node] of uniqueNodes) {
        const region = regionLabel(node.regionHint);
        const data = {
          name: node.name,
          region,
          kind: inferKind(node.name),
          status: "ACTIVE" as const,
          isDemo: airport.isDemo,
          protocol: node.protocol,
          server: node.server,
          port: node.port,
          regionHint: node.regionHint,
          sourceFormat: node.sourceFormat,
          fingerprint,
          rawConfig: JSON.stringify(node.rawConfig),
        };
        const found = existingByFingerprint.get(fingerprint);
        if (found) {
          await tx.node.update({
            where: { id: found.id },
            data,
          });
          updatedCount += 1;
          upsertedIds.push(found.id);
        } else {
          const created = await tx.node.create({
            data: {
              airportId: airport.id,
              ...data,
            },
          });
          createdCount += 1;
          upsertedIds.push(created.id);
        }
      }

      const disappeared = existing.filter(
        (row) => !uniqueNodes.has(row.fingerprint as string)
      );
      if (disappeared.length > 0) {
        await tx.node.updateMany({
          where: {
            airportId: airport.id,
            fingerprint: { in: disappeared.map((row) => row.fingerprint as string) },
          },
          data: { status: "PAUSED" },
        });
      }

      const nodes = await tx.node.findMany({
        where: { id: { in: upsertedIds } },
        select: {
          id: true,
          name: true,
          protocol: true,
          server: true,
          port: true,
          regionHint: true,
          status: true,
        },
        orderBy: { name: "asc" },
      });

      return {
        createdCount,
        updatedCount,
        deactivatedCount: disappeared.length,
        nodes: nodes.map(toSummary),
      };
    });

    return {
      airportId: airport.id,
      airportSlug: airport.slug,
      airportIsDemo: airport.isDemo,
      parsedCount: parsed.nodes.length,
      unsupportedCount: parsed.unsupported.length,
      invalidCount: parsed.invalid.length,
      createdCount: result.createdCount,
      updatedCount: result.updatedCount,
      deactivatedCount: result.deactivatedCount,
      nodes: result.nodes,
      unsupported: parsed.unsupported,
      invalid: parsed.invalid,
    };
  } catch (error) {
    if (error instanceof SubscriptionError) throw error;
    throw new SubscriptionError("DATABASE_UNAVAILABLE");
  }
}
