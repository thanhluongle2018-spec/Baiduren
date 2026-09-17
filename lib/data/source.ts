import type { DataMode } from "@/types";
import { getPrisma } from "@/lib/prisma";
import type { PrismaClient } from "@/lib/generated/prisma/client";

export type LoadedData<T> = {
  demo: boolean;
  source: DataMode;
  data: T;
};

function isEmptyValue<T>(value: T): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export async function loadDatabaseOrDemo<T>(
  loader: (prisma: PrismaClient) => Promise<T | null>,
  fallback: T
): Promise<LoadedData<T>> {
  try {
    const prisma = getPrisma();
    const data = await loader(prisma);
    if (isEmptyValue(data) || data == null) {
      return { demo: true, source: "demo", data: fallback };
    }
    const formalCount = await prisma.airport.count({
      where: { isDemo: false },
    });
    return {
      demo: formalCount === 0,
      source: "database",
      data,
    };
  } catch {
    return { demo: true, source: "demo", data: fallback };
  }
}

export async function airportScope(prisma: PrismaClient) {
  const formalCount = await prisma.airport.count({
    where: { isDemo: false },
  });
  if (formalCount > 0) {
    return { isDemo: false as const, status: "ACTIVE" as const };
  }
  return { status: "ACTIVE" as const };
}

export function toNumber(value: unknown, fallback = 0): number {
  if (value == null) return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    const numeric = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(numeric) ? numeric : fallback;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function logoTextFromName(name: string) {
  return [...name][0] ?? "?";
}

export function toIso(value: Date | string | null | undefined) {
  if (!value) return new Date(0).toISOString();
  return value instanceof Date ? value.toISOString() : value;
}
