"use server";

import { revalidatePath } from "next/cache";

import { isAtelierBranchType } from "@/lib/atelier-student-access";
import {
  canCreateStudentInBranch,
  isCentreFormationBranch,
  isUniversiteBranch,
  requiresStudentImport,
  usesBrevetForBranch,
} from "@/lib/branch-capabilities";
import {
  generateBrevetNumber,
  linkStudentToExtendedBranch,
  searchOrganizationStudentsForBranchImport,
  supportsOptionalStudentImport,
  unlinkStudentFromExtendedBranch,
} from "@/lib/extended-student-import";
import { getPeopleLabels } from "@/lib/people-labels";
import {
  duplicateDocumentMessage,
  findDuplicateIssuedDocument,
} from "@/lib/issued-document-server";
import { importStudentSchema } from "@/lib/schemas/extended-branch";
import { prisma } from "@/lib/prisma";
import { getCurrentBranch } from "../student/student.action";

function revalidateExtendedStudentPages(organizationId: string, branchId: string) {
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/student`,
  );
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/attestations`,
  );
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/brevets`,
  );
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/classEnrollment`,
  );
}

export async function searchOrganizationStudentsForImport(params: {
  query?: string;
  limit?: number;
}) {
  const { branchId, organizationId, canManageStudents, typebranch } =
    await getCurrentBranch();

  if (!canManageStudents) {
    return { ok: false as const, message: "Action non autorisee" };
  }

  if (!supportsOptionalStudentImport(typebranch)) {
    return {
      ok: false as const,
      message: "L'import n'est pas disponible pour ce type de branche",
    };
  }

  const students = await searchOrganizationStudentsForBranchImport({
    organizationId,
    targetBranchId: branchId,
    typebranch,
    query: params.query,
    limit: params.limit,
  });

  return { ok: true as const, students };
}

export async function linkStudentToBranchAction(input: {
  studentId: string;
  sourceBranchId: string;
  classeId?: string;
}) {
  const { branchId, organizationId, canManageStudents, typebranch } =
    await getCurrentBranch();

  if (!canManageStudents) {
    return { ok: false as const, message: "Action non autorisee" };
  }

  if (!supportsOptionalStudentImport(typebranch)) {
    return { ok: false as const, message: "Import non autorise pour cette branche" };
  }

  if (isUniversiteBranch(typebranch) && !input.classeId?.trim()) {
    return {
      ok: false as const,
      message: "Selectionnez une filiere et un auditoire avant l'import",
    };
  }

  const parsed = importStudentSchema.safeParse({
    studentId: input.studentId,
    targetBranchId: branchId,
    sourceBranchId: input.sourceBranchId,
  });

  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Donnees invalides",
    };
  }

  try {
    const link = await linkStudentToExtendedBranch({
      studentId: parsed.data.studentId,
      sourceBranchId: parsed.data.sourceBranchId,
      targetBranchId: branchId,
      organizationId,
      typebranch,
      classeId: input.classeId?.trim(),
    });

    revalidateExtendedStudentPages(organizationId, branchId);
    return { ok: true as const, linkId: link.id };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Import impossible",
    };
  }
}

/** @deprecated Utiliser linkStudentToBranchAction */
export async function linkStudentToAtelierAction(input: {
  studentId: string;
  sourceBranchId: string;
}) {
  return linkStudentToBranchAction(input);
}

export async function unlinkStudentFromBranchAction(studentId: string) {
  const { branchId, organizationId, canManageStudents, typebranch } =
    await getCurrentBranch();

  if (!canManageStudents) {
    return { ok: false as const, message: "Action non autorisee" };
  }

  if (!supportsOptionalStudentImport(typebranch)) {
    return { ok: false as const, message: "Action non autorisee" };
  }

  try {
    await unlinkStudentFromExtendedBranch({
      studentId,
      targetBranchId: branchId,
    });
    revalidateExtendedStudentPages(organizationId, branchId);
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Retrait impossible",
    };
  }
}

/** @deprecated Utiliser unlinkStudentFromBranchAction */
export async function unlinkStudentFromAtelierAction(studentId: string) {
  return unlinkStudentFromBranchAction(studentId);
}

export async function getStudentPageContextAction() {
  const ctx = await getCurrentBranch();

  return {
    typebranch: ctx.typebranch,
    peopleLabels: getPeopleLabels(ctx.typebranch),
    canCreateStudents:
      canCreateStudentInBranch(ctx.typebranch) && ctx.canManageStudents,
    requiresImport: requiresStudentImport(ctx.typebranch),
    supportsImport: supportsOptionalStudentImport(ctx.typebranch),
    requiresAuditoireOnImport: isUniversiteBranch(ctx.typebranch),
    importScope: requiresStudentImport(ctx.typebranch)
      ? ("school_only" as const)
      : ("organization" as const),
    canManageStudents: ctx.canManageStudents,
  };
}

export async function getUniversityImportEnrollmentOptionsAction() {
  const { branchId, canManageStudents, typebranch } = await getCurrentBranch();

  if (!canManageStudents) {
    return { ok: false as const, message: "Action non autorisee" };
  }

  if (!isUniversiteBranch(typebranch)) {
    return {
      ok: false as const,
      message: "Disponible uniquement pour une branche universite",
    };
  }

  const [filieres, auditoires, schoolYear] = await Promise.all([
    prisma.option.findMany({
      where: { branchId, statusOption: { not: false } },
      include: { section: { select: { nameSection: true } } },
      orderBy: { nameOption: "asc" },
    }),
    prisma.classe.findMany({
      where: {
        branchId,
        statusClasse: { not: false },
        optionId: { not: null },
      },
      include: {
        option: { select: { id: true, nameOption: true } },
      },
      orderBy: { nameClasse: "asc" },
    }),
    prisma.schoolYear.findFirst({
      where: { branchId, isCurrentYear: true, isArchived: false },
      select: { id: true, nameYear: true },
    }),
  ]);

  if (!schoolYear) {
    return {
      ok: false as const,
      message: "Aucune annee academique en cours. Creez-en une avant l'import.",
    };
  }

  return {
    ok: true as const,
    schoolYear,
    filieres: filieres.map((filiere) => ({
      id: filiere.id,
      nameOption: filiere.nameOption,
      sectionName: filiere.section?.nameSection ?? null,
    })),
    auditoires: auditoires.map((auditoire) => ({
      id: auditoire.id,
      nameClasse: auditoire.nameClasse,
      optionId: auditoire.optionId!,
      optionName: auditoire.option?.nameOption ?? "",
    })),
  };
}

export async function getAtelierAttestationsAction() {
  const { branchId, organizationId, canIssueDocuments, typebranch } =
    await getCurrentBranch();

  if (!isAtelierBranchType(typebranch)) {
    return { ok: false as const, message: "Page reservee aux ateliers" };
  }

  const [links, documents, branch] = await Promise.all([
    prisma.studentBranchLink.findMany({
      where: { targetBranchId: branchId, isActive: true },
      include: {
        student: {
          include: {
            branchMember: {
              include: {
                member: { include: { user: true } },
                branch: { select: { name: true } },
              },
            },
            classEnrollment: {
              where: {
                branchId,
                statusEnrollment: true,
                schoolYear: { isCurrentYear: true },
              },
              take: 1,
              include: { classe: true },
            },
          },
        },
        sourceBranch: { select: { name: true } },
      },
      orderBy: { enrolledAt: "desc" },
    }),
    prisma.issuedDocument.findMany({
      where: { branchId, documentType: "ATTESTATION_PARTICIPATION" },
      orderBy: { issuedAt: "desc" },
      take: 100,
    }),
    prisma.branch.findFirst({
      where: { id: branchId, organizationId },
      select: {
        name: true,
        organization: { select: { name: true } },
        schoolYear: {
          where: { isCurrentYear: true },
          select: { id: true, nameYear: true },
          take: 1,
        },
      },
    }),
  ]);

  return {
    ok: true as const,
    canManage: canIssueDocuments,
    branchName: branch?.name ?? "",
    organizationName: branch?.organization.name ?? "",
    schoolYearName: branch?.schoolYear[0]?.nameYear ?? "",
    participants: links.map((link) => {
      const user = link.student.branchMember.member.user;
      const enrollment = link.student.classEnrollment[0];
      return {
        studentId: link.student.id,
        nom: user?.name ?? "",
        postnom: user?.postnom ?? "",
        prenom: user?.prenom ?? "",
        username: user?.username ?? "",
        sourceBranchName: link.sourceBranch.name,
        groupName: enrollment?.classe?.nameClasse ?? null,
      };
    }),
    documents,
  };
}

export async function issueAtelierAttestationAction(input: {
  studentId: string;
  title?: string;
  workshopName?: string;
}) {
  const { branchId, organizationId, canIssueDocuments, typebranch } =
    await getCurrentBranch();

  if (!canIssueDocuments || !isAtelierBranchType(typebranch)) {
    return { ok: false as const, message: "Action non autorisee" };
  }

  const link = await prisma.studentBranchLink.findFirst({
    where: { studentId: input.studentId, targetBranchId: branchId, isActive: true },
  });

  if (!link) {
    return { ok: false as const, message: "Eleve non inscrit dans cet atelier" };
  }

  const [student, schoolYear] = await Promise.all([
    prisma.student.findUnique({
      where: { id: input.studentId },
      include: {
        branchMember: { include: { member: { include: { user: true } } } },
        classEnrollment: {
          where: { branchId, statusEnrollment: true },
          take: 1,
          include: { classe: true },
        },
      },
    }),
    prisma.schoolYear.findFirst({
      where: { branchId, isCurrentYear: true },
      select: { id: true, nameYear: true },
    }),
  ]);

  if (!student) {
    return { ok: false as const, message: "Eleve introuvable" };
  }

  const user = student.branchMember.member.user;
  const title =
    input.title?.trim() || "Attestation de participation a l'atelier pratique";

  const duplicate = await findDuplicateIssuedDocument({
    branchId,
    studentId: input.studentId,
    schoolYearId: schoolYear?.id,
    documentType: "ATTESTATION_PARTICIPATION",
    metadata: {
      title,
      workshopName: input.workshopName ?? null,
    },
  });

  if (duplicate) {
    return {
      ok: false as const,
      message: duplicateDocumentMessage(duplicate.title),
    };
  }

  const document = await prisma.issuedDocument.create({
    data: {
      branchId,
      studentId: input.studentId,
      schoolYearId: schoolYear?.id,
      documentType: "ATTESTATION_PARTICIPATION",
      title,
      metadata: {
        workshopName: input.workshopName ?? null,
        groupName: student.classEnrollment[0]?.classe?.nameClasse ?? null,
        studentName: [user?.name, user?.postnom, user?.prenom].filter(Boolean).join(" "),
      },
    },
  });

  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/attestations`,
  );

  return {
    ok: true as const,
    document: {
      id: document.id,
      title: document.title,
      issuedAt: document.issuedAt.toISOString(),
      metadata: document.metadata,
    },
  };
}

export async function getCentreBrevetsAction() {
  const { branchId, organizationId, canIssueDocuments, typebranch } =
    await getCurrentBranch();

  if (!usesBrevetForBranch(typebranch)) {
    return { ok: false as const, message: "Page reservee aux centres de formation" };
  }

  const [nativeStudents, links, documents, branch] = await Promise.all([
    prisma.student.findMany({
      where: { branchMember: { branchId } },
      include: {
        branchMember: { include: { member: { include: { user: true } } } },
        classEnrollment: {
          where: {
            branchId,
            statusEnrollment: true,
            schoolYear: { isCurrentYear: true },
          },
          take: 1,
          include: {
            classe: {
              include: {
                option: { include: { section: true } },
              },
            },
          },
        },
      },
    }),
    prisma.studentBranchLink.findMany({
      where: { targetBranchId: branchId, isActive: true },
      include: {
        sourceBranch: { select: { name: true } },
        student: {
          include: {
            branchMember: { include: { member: { include: { user: true } } } },
            classEnrollment: {
              where: {
                branchId,
                statusEnrollment: true,
                schoolYear: { isCurrentYear: true },
              },
              take: 1,
              include: {
                classe: {
                  include: {
                    option: { include: { section: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.issuedDocument.findMany({
      where: { branchId, documentType: "BREVET" },
      orderBy: { issuedAt: "desc" },
      take: 100,
    }),
    prisma.branch.findFirst({
      where: { id: branchId, organizationId },
      select: {
        name: true,
        code: true,
        organization: { select: { name: true } },
        schoolYear: {
          where: { isCurrentYear: true },
          select: { nameYear: true },
          take: 1,
        },
      },
    }),
  ]);

  const learnerMap = new Map<string, {
    studentId: string;
    nom: string;
    postnom: string;
    prenom: string;
    username: string;
    programmeName: string | null;
    sessionName: string | null;
    sourceLabel: string;
    isLinked: boolean;
  }>();

  for (const student of nativeStudents) {
    const user = student.branchMember.member.user;
    const enrollment = student.classEnrollment[0];
    learnerMap.set(student.id, {
      studentId: student.id,
      nom: user?.name ?? "",
      postnom: user?.postnom ?? "",
      prenom: user?.prenom ?? "",
      username: user?.username ?? "",
      programmeName: enrollment?.classe?.option?.nameOption ?? enrollment?.classe?.option?.section?.nameSection ?? null,
      sessionName: enrollment?.classe?.nameClasse ?? null,
      sourceLabel: "Cree au centre",
      isLinked: false,
    });
  }

  for (const link of links) {
    const user = link.student.branchMember.member.user;
    const enrollment = link.student.classEnrollment[0];
    learnerMap.set(link.student.id, {
      studentId: link.student.id,
      nom: user?.name ?? "",
      postnom: user?.postnom ?? "",
      prenom: user?.prenom ?? "",
      username: user?.username ?? "",
      programmeName: enrollment?.classe?.option?.nameOption ?? null,
      sessionName: enrollment?.classe?.nameClasse ?? null,
      sourceLabel: `Importe · ${link.sourceBranch.name}`,
      isLinked: true,
    });
  }

  return {
    ok: true as const,
    canManage: canIssueDocuments,
    branchName: branch?.name ?? "",
    branchCode: branch?.code ?? "",
    organizationName: branch?.organization.name ?? "",
    schoolYearName: branch?.schoolYear[0]?.nameYear ?? "",
    learners: Array.from(learnerMap.values()),
    documents: documents.map((doc) => ({
      id: doc.id,
      studentId: doc.studentId,
      title: doc.title,
      issuedAt: doc.issuedAt.toISOString(),
      metadata: doc.metadata,
    })),
  };
}

export async function issueCentreBrevetAction(input: {
  studentId: string;
  programmeName?: string;
}) {
  const { branchId, organizationId, canIssueDocuments, typebranch } =
    await getCurrentBranch();

  if (!canIssueDocuments || !isCentreFormationBranch(typebranch)) {
    return { ok: false as const, message: "Action non autorisee" };
  }

  const hasAccess =
    (await prisma.student.findFirst({
      where: { id: input.studentId, branchMember: { branchId } },
      select: { id: true },
    })) ||
    (await prisma.studentBranchLink.findFirst({
      where: {
        studentId: input.studentId,
        targetBranchId: branchId,
        isActive: true,
      },
      select: { id: true },
    }));

  if (!hasAccess) {
    return { ok: false as const, message: "Apprenant introuvable dans ce centre" };
  }

  const enrollment = await prisma.classEnrollment.findFirst({
    where: {
      studentId: input.studentId,
      branchId,
      statusEnrollment: true,
      schoolYear: { isCurrentYear: true },
    },
    include: {
      classe: { include: { option: true } },
      schoolYear: true,
    },
  });

  if (!enrollment) {
    return {
      ok: false as const,
      message: "L'apprenant doit etre inscrit a une session active",
    };
  }

  if (!enrollment.classe) {
    return {
      ok: false as const,
      message: "Session d'inscription introuvable",
    };
  }

  const classe = enrollment.classe;

  const [student, branch, brevetNumber] = await Promise.all([
    prisma.student.findUnique({
      where: { id: input.studentId },
      include: {
        branchMember: { include: { member: { include: { user: true } } } },
      },
    }),
    prisma.branch.findUnique({
      where: { id: branchId },
      select: { name: true, code: true, organization: { select: { name: true } } },
    }),
    generateBrevetNumber(branchId),
  ]);

  if (!student || !branch) {
    return { ok: false as const, message: "Donnees introuvables" };
  }

  const user = student.branchMember.member.user;
  const programmeName =
    input.programmeName?.trim() ||
    classe.option?.nameOption ||
    "Programme de formation";

  const duplicate = await findDuplicateIssuedDocument({
    branchId,
    studentId: input.studentId,
    schoolYearId: enrollment.schoolYearId,
    documentType: "BREVET",
  });

  if (duplicate) {
    return {
      ok: false as const,
      message: duplicateDocumentMessage(duplicate.title),
    };
  }

  const document = await prisma.issuedDocument.create({
    data: {
      branchId,
      studentId: input.studentId,
      schoolYearId: enrollment.schoolYearId,
      documentType: "BREVET",
      title: `Brevet de formation - ${programmeName}`,
      metadata: {
        brevetNumber,
        programmeName,
        sessionName: classe.nameClasse,
        schoolYearName: enrollment.schoolYear.nameYear,
        studentName: [user?.name, user?.postnom, user?.prenom].filter(Boolean).join(" "),
      },
    },
  });

  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/brevets`,
  );

  return {
    ok: true as const,
    document: {
      id: document.id,
      brevetNumber,
      title: document.title,
      issuedAt: document.issuedAt.toISOString(),
      studentName: [user?.name, user?.postnom, user?.prenom].filter(Boolean).join(" "),
      username: user?.username ?? "",
      programmeName,
      sessionName: classe.nameClasse,
      schoolYearName: enrollment.schoolYear.nameYear,
      organizationName: branch.organization.name,
      branchName: branch.name,
      branchCode: branch.code,
    },
  };
}
