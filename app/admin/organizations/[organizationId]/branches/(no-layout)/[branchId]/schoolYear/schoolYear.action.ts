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

function revalidateSchoolYearPages(organizationId: string, branchId: string) {
  revalidatePath(`/admin/organizations/${organizationId}/branches/${branchId}/schoolYear`);
  revalidatePath(`/admin/organizations/${organizationId}/branches/${branchId}/schedule`);
}

export async function getCurrentBranch() {
  const { branchId, organizationId, userId } = await requireBranchContext();

  return {
    branchId,
    organizationId,
    userId,
  };
}

export const createSchoolYearAction = action
  .input(schoolYearSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await getCurrentBranch();

    const { nameYear, startYear, endYear, isCurrentYear } = input;

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

    if (isCurrentYear) {
      await prisma.schoolYear.updateMany({
        where: { branchId, isCurrentYear: true },
        data: { isCurrentYear: false },
      });
    }

    const schoolYear = await prisma.schoolYear.create({
      data: {
        branchId,
        nameYear,
        startYear,
        endYear,
        isCurrentYear,
      },
    });
    revalidateSchoolYearPages(organizationId, branchId);
    return schoolYear;
  });

//deleteSchoolYear
export const deleteSchoolYearAction = action
  .input(deleteSchoolYearSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await getCurrentBranch();

    const schoolYear = await prisma.schoolYear.findFirst({
      where: {
        id: input.id,
        branchId,
      },
    });

    if (!schoolYear) {
      throw new Error("Année scolaire introuvable");
    }

    const deletedSchoolYear = await prisma.schoolYear.delete({
      where: { id: input.id },
    });
    revalidateSchoolYearPages(organizationId, branchId);
    return deletedSchoolYear;
  });

export const getSchoolYearsAction = action
  .input(
    z.object({
      branchId: z.string(),
    }),
  )
  .handler(async () => {
    const { branchId } = await getCurrentBranch();
    return prisma.schoolYear.findMany({
      where: {
        branchId,
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
    }),
  )
  .handler(async () => {
    const { branchId } = await getCurrentBranch();
    return prisma.schoolYear.findMany({
      where: {
        branchId,
      },
      orderBy: {
        nameYear: "desc",
      },
    });
  });

export const updateSchoolYearAction = action
  .input(schoolYearSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await getCurrentBranch();

    const { id, nameYear, startYear, endYear, isCurrentYear } = input;

    if (!id) throw new Error("ID manquant");

    const existing = await prisma.schoolYear.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!existing) throw new Error("Année scolaire introuvable");

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

    if (isCurrentYear) {
      await prisma.schoolYear.updateMany({
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

    const updatedSchoolYear = await prisma.schoolYear.update({
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
    revalidateSchoolYearPages(organizationId, branchId);
    return updatedSchoolYear;
  });
