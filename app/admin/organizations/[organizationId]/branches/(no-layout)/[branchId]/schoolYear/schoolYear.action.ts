"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { action } from "@/lib/zsa";
import {
  deleteSchoolYearSchema,
  ISchoolYear,
  schoolYearSchema,
} from "@/src/interfaces/SchoolYear";
import { Prisma } from "@/prisma/generated/prisma/client";
import { z } from "zod";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  canPrepareNextAcademicYear,
  getNextAcademicYearForDate,
} from "@/lib/academic-year";
import { buildIsArchivedUpdate } from "@/lib/archive";
import { canManageOrganization } from "@/lib/auth/session-roles";

function revalidateSchoolYearPages(organizationId: string, branchId: string) {
  revalidatePath(`/admin/organizations/${organizationId}/branches/${branchId}/schoolYear`);
  revalidatePath(`/admin/organizations/${organizationId}/branches/${branchId}/schedule`);
}

export async function getCurrentBranch() {
  const { branchId, organizationId, userId, session } =
    await requireBranchContext();

  return {
    branchId,
    organizationId,
    userId,
    session,
  };
}

function assertCanManageCurrentSchoolYear(session: unknown) {
  if (!canManageOrganization(session)) {
    throw new Error(
      "Seuls les gestionnaires peuvent modifier l'annee scolaire courante",
    );
  }
}

export const createSchoolYearAction = action
  .input(schoolYearSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, session } = await getCurrentBranch();

    const { nameYear, startYear, endYear, isCurrentYear } = input;

    if (isCurrentYear) {
      assertCanManageCurrentSchoolYear(session);
    }

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      throw new Error("Branche introuvable");
    }

    const existYear = await prisma.schoolYear.findFirst({
      where: {
        branchId,
        OR: [{ startYear, endYear }, { nameYear }],
      },
    });

    if (existYear) {
      throw new Error("L'année scolaire existe déjà");
    }

    const schoolYear = await prisma.$transaction(async (tx) => {
      if (isCurrentYear) {
        await tx.schoolYear.updateMany({
          where: { branchId, isCurrentYear: true },
          data: { isCurrentYear: false },
        });
      }

      return tx.schoolYear.create({
        data: {
          branchId,
          nameYear,
          startYear,
          endYear,
          isCurrentYear,
        },
      });
    });
    revalidateSchoolYearPages(organizationId, branchId);
    return schoolYear;
  });

//archiveSchoolYear
export const archiveSchoolYearAction = action
  .input(deleteSchoolYearSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, userId } = await getCurrentBranch();

    const schoolYear = await prisma.schoolYear.findFirst({
      where: {
        id: input.id,
        branchId,
      },
    });

    if (!schoolYear) {
      throw new Error("Année scolaire introuvable");
    }

    if (schoolYear.isCurrentYear) {
      throw new Error(
        "Impossible de clôturer l'année scolaire en cours. Définissez d'abord une autre année comme année courante.",
      );
    }

    const archivedSchoolYear = await prisma.schoolYear.update({
      where: { id: input.id },
      data: buildIsArchivedUpdate(userId),
    });
    revalidateSchoolYearPages(organizationId, branchId);
    return archivedSchoolYear;
  });

/** @deprecated Utiliser archiveSchoolYearAction */
export const deleteSchoolYearAction = archiveSchoolYearAction;

export const getSchoolYearsAction = action
  .input(
    z.object({
      branchId: z.string(),
      includeArchived: z.boolean().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId } = await getCurrentBranch();
    const includeArchived = input.includeArchived ?? false;
    return prisma.schoolYear.findMany({
      where: {
        branchId,
        ...(includeArchived ? {} : { isArchived: false }),
      },
      orderBy: {
        startYear: "desc",
      },
    });
  });

export const getSchoolYearsAction1 = action
  .input(
    z.object({
      branchId: z.string(),
      includeArchived: z.boolean().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId } = await getCurrentBranch();
    const includeArchived = input.includeArchived ?? false;
    return prisma.schoolYear.findMany({
      where: {
        branchId,
        ...(includeArchived ? {} : { isArchived: false }),
      },
      orderBy: {
        nameYear: "desc",
      },
    });
  });

export const getCurrentSchoolYearAction = action.handler(async () => {
  const { branchId } = await getCurrentBranch();

  return prisma.schoolYear.findFirst({
    where: {
      branchId,
      isCurrentYear: true,
    },
  });
});

export const prepareNextSchoolYearAction = action.handler(async () => {
  const { branchId, organizationId, session } = await getCurrentBranch();

  assertCanManageCurrentSchoolYear(session);

  if (!canPrepareNextAcademicYear()) {
    throw new Error("La prochaine annee scolaire peut etre preparee a partir du mois d'aout");
  }

  const nextAcademicYear = getNextAcademicYearForDate();

  const schoolYear = await prisma.schoolYear.upsert({
    where: {
      branchId_nameYear: {
        branchId,
        nameYear: nextAcademicYear.nameYear,
      },
    },
    create: {
      branchId,
      nameYear: nextAcademicYear.nameYear,
      startYear: nextAcademicYear.startYear,
      endYear: nextAcademicYear.endYear,
      isCurrentYear: false,
    },
    update: {
      startYear: nextAcademicYear.startYear,
      endYear: nextAcademicYear.endYear,
    },
  });

  revalidateSchoolYearPages(organizationId, branchId);
  return schoolYear;
});

export const updateSchoolYearAction = action
  .input(schoolYearSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, session } = await getCurrentBranch();

    const { id, nameYear, startYear, endYear, isCurrentYear } = input;

    if (!id) throw new Error("ID manquant");

    const existing = await prisma.schoolYear.findFirst({
      where: { id, branchId },
      select: { id: true, isCurrentYear: true },
    });
    if (!existing) throw new Error("Année scolaire introuvable");

    if (isCurrentYear !== existing.isCurrentYear) {
      assertCanManageCurrentSchoolYear(session);
    }

    const duplicate = await prisma.schoolYear.findFirst({
      where: {
        branchId,
        id: { not: id },
        OR: [{ startYear, endYear }, { nameYear }],
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new Error("L'année scolaire existe deja dans cette branche");
    }

    const updatedSchoolYear = await prisma.$transaction(async (tx) => {
      if (isCurrentYear) {
        await tx.schoolYear.updateMany({
          where: {
            branchId,
            id: { not: id },
            isCurrentYear: true,
          },
          data: {
            isCurrentYear: false,
          },
        });
      }

      return tx.schoolYear.update({
        where: {
          id,
        },
        data: {
          nameYear,
          startYear,
          endYear,
          isCurrentYear,
        },
      });
    });
    revalidateSchoolYearPages(organizationId, branchId);
    return updatedSchoolYear;
  });
