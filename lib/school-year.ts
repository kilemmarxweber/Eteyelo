"use server";

import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";

export async function getSchoolYearForBranch(branchId: string) {
  return prisma.schoolYear.findFirst({
    where: { isCurrentYear: true, branchId },
  });
}

export async function requireCurrentSchoolYear(branchId: string) {
  const currentYear = await getSchoolYearForBranch(branchId);

  if (!currentYear) {
    throw new Error("Annee scolaire courante introuvable pour cette branche");
  }

  return currentYear;
}

export async function getSchoolYear() {
  const { branchId } = await requireBranchContext();
  return getSchoolYearForBranch(branchId);
}
