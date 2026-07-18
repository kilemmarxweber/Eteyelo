import { prisma } from "@/lib/prisma";
import {
  ensureUniqueIdentifier,
  generateCourseCode,
} from "@/lib/generated-identifiers";
import { isUniversiteBranch } from "@/lib/branch-capabilities";

export type ImportCourseSearchResult = {
  id: string;
  codeCours: string;
  nameCours: string;
  description: string | null;
  sourceBranchId: string;
  sourceBranchName: string;
  sourceBranchType: string;
  alreadyImported: boolean;
};

export function supportsCourseImport(typebranch: unknown): boolean {
  return isUniversiteBranch(typebranch);
}

function buildCourseSearchFilter(search?: string) {
  if (!search?.trim()) return {};

  return {
    OR: [
      { nameCours: { contains: search, mode: "insensitive" as const } },
      { codeCours: { contains: search, mode: "insensitive" as const } },
      { description: { contains: search, mode: "insensitive" as const } },
    ],
  };
}

export async function searchOrganizationCoursesForBranchImport(params: {
  organizationId: string;
  targetBranchId: string;
  query?: string;
  limit?: number;
}): Promise<ImportCourseSearchResult[]> {
  const search = params.query?.trim();
  const limit = params.limit ?? 30;

  const courses = await prisma.cours.findMany({
    where: {
      branch: {
        organizationId: params.organizationId,
        isActive: true,
        id: { not: params.targetBranchId },
      },
      statusCours: { not: false },
      ...buildCourseSearchFilter(search),
    },
    take: limit,
    orderBy: { nameCours: "asc" },
    include: {
      branch: { select: { id: true, name: true, typebranch: true } },
    },
  });

  const targetNames = new Set(
    (
      await prisma.cours.findMany({
        where: { branchId: params.targetBranchId },
        select: { nameCours: true },
      })
    ).map((course) => course.nameCours.trim().toLowerCase()),
  );

  return courses.map((course) => ({
    id: course.id,
    codeCours: course.codeCours,
    nameCours: course.nameCours,
    description: course.description,
    sourceBranchId: course.branch.id,
    sourceBranchName: course.branch.name,
    sourceBranchType: course.branch.typebranch,
    alreadyImported: targetNames.has(course.nameCours.trim().toLowerCase()),
  }));
}

export async function importCourseToBranch(params: {
  courseId: string;
  sourceBranchId: string;
  targetBranchId: string;
  organizationId: string;
  targetBranchType: unknown;
}) {
  const sourceCourse = await prisma.cours.findFirst({
    where: {
      id: params.courseId,
      branchId: params.sourceBranchId,
      branch: { organizationId: params.organizationId },
    },
    include: {
      coursPonderations: {
        include: {
          option: { select: { codeOption: true, nameOption: true } },
        },
      },
    },
  });

  if (!sourceCourse) {
    throw new Error("Cours introuvable dans la branche source");
  }

  const existing = await prisma.cours.findFirst({
    where: {
      branchId: params.targetBranchId,
      nameCours: { equals: sourceCourse.nameCours.trim(), mode: "insensitive" },
    },
    select: { id: true },
  });

  if (existing) {
    throw new Error("Ce cours existe deja dans cette branche");
  }

  const codeCours = await ensureUniqueIdentifier({
    base: generateCourseCode(sourceCourse.nameCours),
    separator: "",
    exists: async (value) =>
      Boolean(
        await prisma.cours.findFirst({
          where: { branchId: params.targetBranchId, codeCours: value },
          select: { id: true },
        }),
      ),
  });

  return prisma.$transaction(async (tx) => {
    const created = await tx.cours.create({
      data: {
        branchId: params.targetBranchId,
        nameCours: sourceCourse.nameCours.trim(),
        description: sourceCourse.description,
        codeCours,
        statusCours: true,
      },
    });

    if (isUniversiteBranch(params.targetBranchType)) {
      for (const ponderation of sourceCourse.coursPonderations) {
        const targetOption = await tx.option.findFirst({
          where: {
            branchId: params.targetBranchId,
            OR: [
              { codeOption: ponderation.option.codeOption },
              { nameOption: ponderation.option.nameOption },
            ],
          },
          select: { id: true },
        });

        if (!targetOption) continue;

        await tx.coursOptionPonderation.upsert({
          where: {
            branchId_coursId_optionId: {
              branchId: params.targetBranchId,
              coursId: created.id,
              optionId: targetOption.id,
            },
          },
          create: {
            branchId: params.targetBranchId,
            coursId: created.id,
            optionId: targetOption.id,
            ponderation: ponderation.ponderation,
          },
          update: {
            ponderation: ponderation.ponderation,
          },
        });
      }
    }

    return created;
  });
}
