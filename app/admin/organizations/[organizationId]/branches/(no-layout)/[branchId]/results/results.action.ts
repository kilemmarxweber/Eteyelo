"use server";

import { canAccessResultsArea } from "@/lib/auth/session-roles";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { prisma } from "@/lib/prisma";
import {
  buildSchoolReportContext,
  schoolReportBranchSelect,
} from "@/lib/reports/resolve-school-branding";
import { action } from "@/lib/zsa";

export const getResultsReportContextAction = action.handler(async () => {
  const { branchId, organizationId, session } = await requireBranchContext();

  if (!canAccessResultsArea(session)) {
    throw new Error("Action non autorisée");
  }

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, organizationId },
    select: schoolReportBranchSelect,
  });

  if (!branch) throw new Error("Branche active introuvable");

  return buildSchoolReportContext(branch);
});
