import "dotenv/config";
import { PrismaClient } from "@/prisma/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

/** Bump when Prisma schema fields change so the cached client is rebuilt in dev. */
const PRISMA_CLIENT_VERSION = "phase18-exchange-rates-1";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaClientVersion?: string;
};

function createPrismaClient() {
  return new PrismaClient({
    adapter: adapter as any, // 👈 important workaround TS/Prisma 7
  });
}

function getPrismaClient() {
  const existing = globalForPrisma.prisma;
  const hasExchangeRateDelegate =
    typeof (existing as { exchangeRate?: { findFirst?: unknown } })
      ?.exchangeRate?.findFirst === "function";

  if (
    existing &&
    globalForPrisma.prismaClientVersion === PRISMA_CLIENT_VERSION &&
    hasExchangeRateDelegate
  ) {
    return existing;
  }

  if (existing) {
    void existing.$disconnect();
  }

  const client = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
    globalForPrisma.prismaClientVersion = PRISMA_CLIENT_VERSION;
  }
  return client;
}

export const prisma = getPrismaClient();
