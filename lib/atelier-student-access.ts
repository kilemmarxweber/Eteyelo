import { prisma } from "@/lib/prisma";
import { isSchoolBranch } from "@/lib/branch-capabilities";
import { normalizeBranchType } from "@/lib/academic-structure";
import type { Prisma } from "@/prisma/generated/prisma/client";
import {
  isCtebLevel,
  isHumanitesLevel,
  SECONDARY_HUMANITES_LEVELS,
} from "@/lib/class-structure";
import { CTEB_OPTION_CODE, isCtebOption } from "@/lib/class-catalog";
import {
  ANGOLA_CICLO_OPTION_CODE,
  ANGOLA_CICLO_OPTION_CODE_LEGACY,
  ANGOLA_REDUCED_LEVEL,
  ANGOLA_SECOND_CYCLE_LEVELS,
  isAngolaFirstCycleLevel,
  isAngolaNucleoComumOption,
  isAngolaReducedHoursLevel,
  isAngolaSecondCycleLevel,
} from "@/lib/angola-secondary-structure";

export const ATELIER_IMPORT_SOURCE_CYCLE = "SECONDAIRE" as const;

/** Humanités (1è–4è) + 2.º ciclo Angola — pas le tronc commun / núcleo comum. */
export const ATELIER_IMPORTABLE_LEVELS = [
  ...SECONDARY_HUMANITES_LEVELS,
  "1e",
  "2e",
  "3e",
  "4e",
  ...ANGOLA_SECOND_CYCLE_LEVELS,
  ANGOLA_REDUCED_LEVEL,
  "9a",
  "9è",
  "9e",
  "10a",
  "10è",
  "10e",
  "11a",
  "11è",
  "11e",
  "12a",
  "12è",
  "12e",
  "13a",
  "13è",
  "13e",
] as const;

const ATELIER_EXCLUDED_OPTION_CODES = [
  CTEB_OPTION_CODE,
  "TC",
  "TRONC",
  "TRONC_COM",
  "TRONCCOM",
  ANGOLA_CICLO_OPTION_CODE,
  ANGOLA_CICLO_OPTION_CODE_LEGACY,
] as const;

export function isAtelierImportableClass(input: {
  cycle?: string | null;
  level?: string | null;
  optionName?: string | null;
  optionCode?: string | null;
}): boolean {
  if (input.cycle && input.cycle !== ATELIER_IMPORT_SOURCE_CYCLE) {
    return false;
  }

  const level = (input.level ?? "").trim();
  if (!level) return false;
  if (isCtebLevel(level) || isAngolaFirstCycleLevel(level)) return false;
  if (
    isCtebOption({
      nameOption: input.optionName,
      codeOption: input.optionCode,
    })
  ) {
    return false;
  }
  if (
    isAngolaNucleoComumOption({
      nameOption: input.optionName,
      codeOption: input.optionCode,
    })
  ) {
    return false;
  }

  return (
    isHumanitesLevel(level) ||
    isAngolaSecondCycleLevel(level) ||
    isAngolaReducedHoursLevel(level)
  );
}

/**
 * Inscription année courante en humanités (cycle secondaire hors tronc commun).
 * Primaire, maternelle, CTEB 7è/8è et núcleo comum Angola sont exclus.
 */
export function secondaryCycleCurrentEnrollmentWhere(): Prisma.ClassEnrollmentWhereInput {
  return {
    statusEnrollment: true,
    schoolYear: { isCurrentYear: true, isArchived: false },
    AND: [
      {
        OR: [
          { classe: { cycle: ATELIER_IMPORT_SOURCE_CYCLE } },
          {
            AND: [
              { classe: { cycle: null } },
              { branch: { typebranch: ATELIER_IMPORT_SOURCE_CYCLE } },
            ],
          },
        ],
      },
      {
        classe: {
          level: { in: [...ATELIER_IMPORTABLE_LEVELS] },
        },
      },
      {
        NOT: {
          classe: {
            option: {
              OR: [
                { codeOption: { in: [...ATELIER_EXCLUDED_OPTION_CODES] } },
                {
                  nameOption: {
                    contains: "tronc commun",
                    mode: "insensitive",
                  },
                },
                {
                  nameOption: {
                    contains: "tronco comum",
                    mode: "insensitive",
                  },
                },
                {
                  nameOption: {
                    contains: "nucleo comum",
                    mode: "insensitive",
                  },
                },
                {
                  nameOption: {
                    contains: "núcleo comum",
                    mode: "insensitive",
                  },
                },
              ],
            },
          },
        },
      },
    ],
  };
}

export async function getBranchTypebranch(branchId: string) {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { typebranch: true, organizationId: true },
  });

  if (!branch) {
    throw new Error("Branche introuvable");
  }

  return branch;
}

export function buildStudentAccessWhere(branchId: string, organizationId: string) {
  return {
    OR: [
      {
        branchMember: {
          branchId,
          isActive: true,
          member: { organizationId },
        },
      },
      {
        branchLinks: {
          some: {
            targetBranchId: branchId,
            isActive: true,
          },
        },
      },
    ],
  };
}

export async function assertStudentAccessibleInBranch(params: {
  studentId: string;
  branchId: string;
  organizationId: string;
}) {
  const student = await prisma.student.findFirst({
    where: {
      id: params.studentId,
      ...buildStudentAccessWhere(params.branchId, params.organizationId),
    },
    select: { id: true },
  });

  if (!student) {
    throw new Error("Eleve introuvable dans cette branche");
  }

  return student;
}

export async function assertImportableSchoolStudent(params: {
  studentId: string;
  organizationId: string;
}) {
  const student = await prisma.student.findFirst({
    where: {
      id: params.studentId,
      branchMember: {
        member: { organizationId: params.organizationId },
        branch: {
          organizationId: params.organizationId,
          isActive: true,
        },
      },
      classEnrollment: {
        some: secondaryCycleCurrentEnrollmentWhere(),
      },
    },
    include: {
      branchMember: {
        select: {
          branchId: true,
          branch: { select: { name: true, typebranch: true } },
        },
      },
    },
  });

  if (!student) {
    throw new Error(
      "L'eleve doit etre inscrit en humanites (pas tronc commun, primaire ni maternelle)",
    );
  }

  if (!isSchoolBranch(student.branchMember.branch.typebranch)) {
    throw new Error("Seuls les eleves scolaires peuvent etre importes dans un atelier");
  }

  return student;
}

export function isAtelierBranchType(typebranch: unknown) {
  return normalizeBranchType(typebranch) === "ATELIER";
}
