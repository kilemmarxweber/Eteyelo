import "server-only";

import { prisma } from "@/lib/prisma";

type BranchRef = {
  id: string;
};

const assignedEnrollmentWhere = (params: {
  branchId: string | { in: string[] };
  createdBefore?: Date;
}) => ({
  branchId: params.branchId,
  statusEnrollment: true,
  schoolYear: { isCurrentYear: true },
  ...(params.createdBefore
    ? { createdAt: { lte: params.createdBefore } }
    : {}),
});

/** Compte uniquement les élèves/apprenants/étudiants affectés (inscrits à une classe de l'année en cours). */
export async function countBranchStudents(params: {
  branchId: string;
  createdBefore?: Date;
}): Promise<number> {
  const { branchId, createdBefore } = params;

  const enrollments = await prisma.classEnrollment.groupBy({
    by: ["studentId"],
    where: assignedEnrollmentWhere({ branchId, createdBefore }),
  });

  return enrollments.length;
}

/** Compte par branche les apprenants affectés (inscrits à une classe de l'année en cours). */
export async function getStudentCountsByBranchId(
  branches: BranchRef[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  if (branches.length === 0) {
    return counts;
  }

  const branchIds = branches.map((branch) => branch.id);
  for (const branchId of branchIds) {
    counts.set(branchId, 0);
  }

  const enrollments = await prisma.classEnrollment.findMany({
    where: assignedEnrollmentWhere({ branchId: { in: branchIds } }),
    select: {
      branchId: true,
      studentId: true,
    },
  });

  const assignedByBranch = new Map<string, Set<string>>();
  for (const enrollment of enrollments) {
    const studentIds =
      assignedByBranch.get(enrollment.branchId) ?? new Set<string>();
    studentIds.add(enrollment.studentId);
    assignedByBranch.set(enrollment.branchId, studentIds);
  }

  for (const branchId of branchIds) {
    counts.set(branchId, assignedByBranch.get(branchId)?.size ?? 0);
  }

  return counts;
}
