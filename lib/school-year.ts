"use server";

import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";

export async function getSchoolYear() {
  const { branchId } = await requireBranchContext();

  return await prisma.schoolYear.findFirst({
    where: { isCurrentYear: true, branchId },
  });
}
