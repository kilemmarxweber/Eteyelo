import { prisma } from "@/lib/prisma";
import {
  isCentreFormationBranch,
  isUniversiteBranch,
  requiresStudentImport,
} from "@/lib/branch-capabilities";
import { normalizeBranchType } from "@/lib/academic-structure";
import { assertImportableSchoolStudent } from "@/lib/atelier-student-access";

export type ImportSearchResult = {
  id: string;
  nom: string;
  postnom: string;
  prenom: string;
  username: string;
  sexe: string;
  sourceBranchId: string;
  sourceBranchName: string;
  sourceBranchType: string;
  alreadyLinked: boolean;
};

export function supportsOptionalStudentImport(typebranch: unknown): boolean {
  const normalized = normalizeBranchType(typebranch);
  return (
    requiresStudentImport(typebranch) ||
    isCentreFormationBranch(typebranch) ||
    isUniversiteBranch(typebranch)
  );
}

export function isLinkOnlyBranch(typebranch: unknown): boolean {
  return requiresStudentImport(typebranch);
}

function buildSearchFilter(search?: string) {
  if (!search?.trim()) return {};

  return {
    OR: [
      {
        branchMember: {
          member: { user: { name: { contains: search, mode: "insensitive" as const } } },
        },
      },
      {
        branchMember: {
          member: { user: { postnom: { contains: search, mode: "insensitive" as const } } },
        },
      },
      {
        branchMember: {
          member: { user: { prenom: { contains: search, mode: "insensitive" as const } } },
        },
      },
      {
        branchMember: {
          member: {
            user: { username: { contains: search, mode: "insensitive" as const } },
          },
        },
      },
    ],
  };
}

export async function searchOrganizationStudentsForBranchImport(params: {
  organizationId: string;
  targetBranchId: string;
  typebranch: unknown;
  query?: string;
  limit?: number;
}): Promise<ImportSearchResult[]> {
  const search = params.query?.trim();
  const limit = params.limit ?? 25;
  const linkOnly = isLinkOnlyBranch(params.typebranch);

  const students = await prisma.student.findMany({
    where: {
      branchMember: {
        member: { organizationId: params.organizationId },
        branch: {
          organizationId: params.organizationId,
          isActive: true,
          id: { not: params.targetBranchId },
          ...(linkOnly
            ? { typebranch: { in: ["PRIMAIRE", "SECONDAIRE"] } }
            : {}),
        },
      },
      ...buildSearchFilter(search),
    },
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      branchLinks: {
        where: {
          targetBranchId: params.targetBranchId,
          isActive: true,
        },
        select: { id: true },
      },
      branchMember: {
        include: {
          branch: { select: { id: true, name: true, typebranch: true } },
          member: { include: { user: true } },
        },
      },
    },
  });

  return students.map((student) => {
    const user = student.branchMember.member.user;
    return {
      id: student.id,
      nom: user?.name ?? "",
      postnom: user?.postnom ?? "",
      prenom: user?.prenom ?? "",
      username: user?.username ?? "",
      sexe: user?.sexe ?? "",
      sourceBranchId: student.branchMember.branch.id,
      sourceBranchName: student.branchMember.branch.name,
      sourceBranchType: student.branchMember.branch.typebranch,
      alreadyLinked: student.branchLinks.length > 0,
    };
  });
}

export async function linkStudentToExtendedBranch(params: {
  studentId: string;
  sourceBranchId: string;
  targetBranchId: string;
  organizationId: string;
  typebranch: unknown;
  classeId?: string;
}) {
  if (isLinkOnlyBranch(params.typebranch)) {
    const student = await assertImportableSchoolStudent({
      studentId: params.studentId,
      organizationId: params.organizationId,
    });

    if (student.branchMember.branchId !== params.sourceBranchId) {
      throw new Error("La branche source ne correspond pas a l'eleve");
    }
  } else {
    const student = await prisma.student.findFirst({
      where: {
        id: params.studentId,
        branchMember: {
          member: { organizationId: params.organizationId },
          branch: {
            organizationId: params.organizationId,
            id: params.sourceBranchId,
            isActive: true,
          },
        },
      },
      select: { id: true },
    });

    if (!student) {
      throw new Error("Apprenant introuvable dans la branche source");
    }
  }

  const existing = await prisma.studentBranchLink.findUnique({
    where: {
      studentId_targetBranchId: {
        studentId: params.studentId,
        targetBranchId: params.targetBranchId,
      },
    },
  });

  if (existing?.isActive) {
    throw new Error("Cet apprenant est deja lie a cette branche");
  }

  const link = existing
    ? await prisma.studentBranchLink.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          endedAt: null,
          sourceBranchId: params.sourceBranchId,
          linkType: "IMPORTED",
        },
      })
    : await prisma.studentBranchLink.create({
        data: {
          studentId: params.studentId,
          targetBranchId: params.targetBranchId,
          sourceBranchId: params.sourceBranchId,
          linkType: "IMPORTED",
        },
      });

  if (isUniversiteBranch(params.typebranch)) {
    if (!params.classeId) {
      throw new Error("L'auditoire est obligatoire pour importer un etudiant");
    }

    await enrollStudentInUniversiteAuditoire({
      studentId: params.studentId,
      branchId: params.targetBranchId,
      classeId: params.classeId,
    });
  }

  return link;
}

export async function enrollStudentInUniversiteAuditoire(params: {
  studentId: string;
  branchId: string;
  classeId: string;
}) {
  const [schoolYear, classe] = await Promise.all([
    prisma.schoolYear.findFirst({
      where: {
        branchId: params.branchId,
        isCurrentYear: true,
        isArchived: false,
      },
      select: { id: true },
    }),
    prisma.classe.findFirst({
      where: {
        id: params.classeId,
        branchId: params.branchId,
        statusClasse: { not: false },
        optionId: { not: null },
      },
      select: { id: true },
    }),
  ]);

  if (!schoolYear) {
    throw new Error("Aucune annee academique en cours");
  }

  if (!classe) {
    throw new Error("Auditoire ou filiere invalide");
  }

  await prisma.classEnrollment.upsert({
    where: {
      schoolYearId_studentId: {
        schoolYearId: schoolYear.id,
        studentId: params.studentId,
      },
    },
    create: {
      branchId: params.branchId,
      schoolYearId: schoolYear.id,
      studentId: params.studentId,
      classeId: params.classeId,
      statusEnrollment: true,
    },
    update: {
      classeId: params.classeId,
      statusEnrollment: true,
    },
  });
}

export async function unlinkStudentFromExtendedBranch(params: {
  studentId: string;
  targetBranchId: string;
}) {
  const link = await prisma.studentBranchLink.findFirst({
    where: {
      studentId: params.studentId,
      targetBranchId: params.targetBranchId,
      isActive: true,
    },
  });

  if (!link) {
    throw new Error("Lien introuvable");
  }

  await prisma.$transaction([
    prisma.studentBranchLink.update({
      where: { id: link.id },
      data: { isActive: false, endedAt: new Date() },
    }),
    prisma.classEnrollment.updateMany({
      where: {
        studentId: params.studentId,
        branchId: params.targetBranchId,
        statusEnrollment: true,
      },
      data: { statusEnrollment: false },
    }),
  ]);
}

export async function fetchLinkedStudentsForBranch(branchId: string) {
  return prisma.studentBranchLink.findMany({
    where: { targetBranchId: branchId, isActive: true },
    include: {
      sourceBranch: { select: { id: true, name: true } },
      student: true,
    },
    orderBy: { enrolledAt: "desc" },
  });
}

export async function generateBrevetNumber(branchId: string) {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { code: true },
  });

  const year = new Date().getFullYear();
  const prefix = `${branch?.code ?? "CF"}-${year}`;
  const count = await prisma.issuedDocument.count({
    where: {
      branchId,
      documentType: "BREVET",
      issuedAt: {
        gte: new Date(`${year}-01-01T00:00:00.000Z`),
        lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
      },
    },
  });

  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}
