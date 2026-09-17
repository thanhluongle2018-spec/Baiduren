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

/** Missing/invalid metrics stay null. Do not coerce untested stages to 0. */
export function toNullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    const numeric = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(numeric) ? numeric : null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function toNullableBoolean(value: unknown): boolean | null {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

export function toNullableInt(value: unknown): number | null {
  const numeric = toNullableNumber(value);
  if (numeric == null) return null;
  return Number.isInteger(numeric) ? numeric : Math.trunc(numeric);
}

export function logoTextFromName(name: string) {
  return [...name][0] ?? "?";
}

export function toIso(value: Date | string | null | undefined) {
  if (!value) return new Date(0).toISOString();
  return value instanceof Date ? value.toISOString() : value;
}
