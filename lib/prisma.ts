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
const PRISMA_CLIENT_VERSION = "user-theme-2";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaClientVersion?: string;
};

function createPrismaClient() {
  return new PrismaClient({
    adapter: adapter as any, // 👈 important workaround TS/Prisma 7
  });
}

/** True when the loaded PrismaClient DMMF includes User.theme. */
function clientKnowsUserTheme(client: PrismaClient | undefined) {
  if (!client) return false;
  try {
    const models = (
      client as unknown as {
        _runtimeDataModel?: {
          models?: Record<string, { fields?: Array<{ name: string }> }>;
        };
      }
    )._runtimeDataModel?.models;
    const userFields = models?.User?.fields ?? models?.user?.fields;
    return Boolean(userFields?.some((field) => field.name === "theme"));
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
    clientKnowsUserTheme(existing)
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
