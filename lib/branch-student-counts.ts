import { requiresStudentImport } from "@/lib/branch-capabilities";
import { secondaryCycleCurrentEnrollmentWhere } from "@/lib/atelier-student-access";
import { prisma } from "@/lib/prisma";

export function countNativeBranchStudents(
  members: { _count: { student: number } }[],
) {
  return members.reduce((total, member) => total + member._count.student, 0);
}

/** Élèves importés visibles dans un atelier (même filtre que la liste élèves). */
export async function countLinkedStudentsByBranch(branchIds: string[]) {
  if (branchIds.length === 0) return new Map<string, number>();

  const rows = await prisma.studentBranchLink.groupBy({
    by: ["targetBranchId"],
    where: {
      targetBranchId: { in: branchIds },
      isActive: true,
      student: {
        classEnrollment: {
          some: secondaryCycleCurrentEnrollmentWhere(),
        },
      },
    },
    _count: { studentId: true },
  });

  return new Map(
    rows.map((row) => [row.targetBranchId, row._count.studentId]),
  );
}

export function resolveBranchStudentsCount(input: {
  typebranch: unknown;
  nativeCount: number;
  linkedCount: number;
}) {
  if (requiresStudentImport(input.typebranch)) return input.linkedCount;
  return input.nativeCount;
}
