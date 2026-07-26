import "dotenv/config";
import { PrismaClient } from "@/prisma/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

/**
 * Bump when Prisma schema fields change so the cached client is rebuilt in dev.
 * Also used to bust Turbopack module cache after `prisma generate`.
 */
const PRISMA_CLIENT_VERSION = "support-ticket-channel-1";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaClientVersion?: string;
};

function createPrismaClient() {
  return new PrismaClient({
    adapter: adapter as any, // 👈 important workaround TS/Prisma 7
  });
}

function modelHasField(
  client: PrismaClient | undefined,
  modelName: string,
  fieldName: string,
) {
  if (!client) return false;
  try {
    const models = (
      client as unknown as {
        _runtimeDataModel?: {
          models?: Record<string, { fields?: Array<{ name: string }> }>;
        };
      }
    )._runtimeDataModel?.models;
    const fields =
      models?.[modelName]?.fields ??
      models?.[modelName.toLowerCase()]?.fields ??
      [];
    return fields.some((field) => field.name === fieldName);
  } catch {
    return false;
  }
}

function getPrismaClient() {
  const existing = globalForPrisma.prisma;
  const hasLibraryBookDelegate =
    typeof (existing as { libraryBook?: { findFirst?: unknown } })?.libraryBook
      ?.findFirst === "function";

  if (
    existing &&
    globalForPrisma.prismaClientVersion === PRISMA_CLIENT_VERSION &&
    hasLibraryBookDelegate &&
    modelHasField(existing, "User", "theme") &&
    modelHasField(existing, "PlatformSupportEscalation", "branch") &&
    modelHasField(existing, "PlatformSupportEscalation", "channel")
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
