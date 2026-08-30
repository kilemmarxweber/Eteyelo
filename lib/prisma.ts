import "dotenv/config";
import { PrismaClient } from "@/prisma/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  applyUserEmailWhere,
  normalizeUserEmailData,
} from "@/lib/prisma-user-email";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

/**
 * Bump when Prisma schema fields change so the cached client is rebuilt in dev.
 * Also used to bust Turbopack module cache after `prisma generate`.
 */
const PRISMA_CLIENT_VERSION = "job-application-desiredCycle-1";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaClientVersion?: string;
};

function createPrismaClient() {
  const client = new PrismaClient({
    adapter: adapter as any, // 👈 important workaround TS/Prisma 7
  }).$extends({
    query: {
      user: {
        async findFirst({ args, query }) {
          applyUserEmailWhere(args.where, { insensitive: true });
          return query(args);
        },
        async findFirstOrThrow({ args, query }) {
          applyUserEmailWhere(args.where, { insensitive: true });
          return query(args);
        },
        async findMany({ args, query }) {
          applyUserEmailWhere(args.where, { insensitive: true });
          return query(args);
        },
        async findUnique({ args, query }) {
          applyUserEmailWhere(args.where, { insensitive: false });
          return query(args);
        },
        async findUniqueOrThrow({ args, query }) {
          applyUserEmailWhere(args.where, { insensitive: false });
          return query(args);
        },
        async create({ args, query }) {
          normalizeUserEmailData(args.data);
          return query(args);
        },
        async update({ args, query }) {
          applyUserEmailWhere(args.where, { insensitive: false });
          normalizeUserEmailData(args.data);
          return query(args);
        },
        async updateMany({ args, query }) {
          applyUserEmailWhere(args.where, { insensitive: true });
          normalizeUserEmailData(args.data);
          return query(args);
        },
        async upsert({ args, query }) {
          applyUserEmailWhere(args.where, { insensitive: false });
          normalizeUserEmailData(args.create);
          normalizeUserEmailData(args.update);
          return query(args);
        },
      },
    },
  });
  return client as unknown as PrismaClient;
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
  const hasBranchPrimaryDomainDelegate =
    typeof (
      existing as { branchPrimaryDomain?: { findMany?: unknown } }
    )?.branchPrimaryDomain?.findMany === "function";

  if (
    existing &&
    globalForPrisma.prismaClientVersion === PRISMA_CLIENT_VERSION &&
    hasLibraryBookDelegate &&
    hasBranchPrimaryDomainDelegate &&
    modelHasField(existing, "User", "theme") &&
    modelHasField(existing, "PlatformSupportEscalation", "branch") &&
    modelHasField(existing, "PlatformSupportEscalation", "channel") &&
    modelHasField(existing, "StudentAttendance", "checkIn") &&
    modelHasField(existing, "TeacherAttendance", "earlyExit") &&
    modelHasField(existing, "PersonnelAttendance", "earlyExit") &&
    modelHasField(existing, "ClassEnrollment", "e13") &&
    modelHasField(existing, "ClassEnrollment", "e80") &&
    modelHasField(existing, "Branch", "educationSystem") &&
    modelHasField(existing, "Branch", "description") &&
    modelHasField(existing, "Classe", "horaireType") &&
    typeof (existing as { absenceCase?: { findFirst?: unknown } })
      ?.absenceCase?.findFirst === "function" &&
    typeof (existing as { appNotification?: { findFirst?: unknown } })
      ?.appNotification?.findFirst === "function" &&
    typeof (existing as { branchCycle?: { findFirst?: unknown } })
      ?.branchCycle?.findFirst === "function" &&
    modelHasField(existing, "Personnel", "isActive") &&
    modelHasField(existing, "Personnel", "deactivatedAt") &&
    modelHasField(existing, "Teacher", "isActive") &&
    modelHasField(existing, "Teacher", "deactivatedAt") &&
    modelHasField(existing, "JobApplication", "desiredCycle")
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
