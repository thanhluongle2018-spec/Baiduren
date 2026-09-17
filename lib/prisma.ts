import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  }

  const adapter = new PrismaPg(url);
  return new PrismaClient({ adapter });
}

export function getPrisma() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export async function pingDatabase(): Promise<"connected" | "unavailable"> {
  try {
    const prisma = getPrisma();
    await prisma.$queryRaw`SELECT 1`;
    return "connected";
  } catch {
    return "unavailable";
  }
}

export async function withPrisma<T>(
  fn: (prisma: PrismaClient) => Promise<T>
): Promise<T | null> {
  try {
    return await fn(getPrisma());
  } catch {
    return null;
  }
}
