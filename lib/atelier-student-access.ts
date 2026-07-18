import { prisma } from "@/lib/prisma";
import { isSchoolBranch } from "@/lib/branch-capabilities";
import { normalizeBranchType } from "@/lib/academic-structure";

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
          typebranch: { in: ["PRIMAIRE", "SECONDAIRE"] },
        },
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
      "L'eleve doit provenir d'une branche scolaire (primaire ou secondaire) de l'organisation",
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
