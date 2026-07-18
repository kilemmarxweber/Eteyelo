"use server";

import { revalidatePath } from "next/cache";

import { isUniversiteBranch } from "@/lib/branch-capabilities";
import {
  buildReleveNotesData,
  generateReleveNumber,
} from "@/lib/releve-notes-builder";
import {
  UNIVERSITY_ATTESTATION_KINDS,
  type UniversityAttestationKind,
  UNIVERSITY_ATTESTATION_LABELS,
} from "@/lib/pdf/university-attestation-layout";
import {
  duplicateDocumentMessage,
  findDuplicateIssuedDocument,
} from "@/lib/issued-document-server";
import { prisma } from "@/lib/prisma";
import { getCurrentBranch } from "../student/student.action";

function revalidateUniversityPages(organizationId: string, branchId: string) {
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/releves`,
  );
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/attestations`,
  );
}

async function studentHasBranchAccess(studentId: string, branchId: string) {
  const native = await prisma.student.findFirst({
    where: { id: studentId, branchMember: { branchId } },
    select: { id: true },
  });

  if (native) return true;

  const linked = await prisma.studentBranchLink.findFirst({
    where: { studentId, targetBranchId: branchId, isActive: true },
    select: { id: true },
  });

  return Boolean(linked);
}

type UniversityLearner = {
  studentId: string;
  nom: string;
  postnom: string;
  prenom: string;
  username: string;
  auditoireName: string | null;
  auditoireLevel: string | null;
  filiereName: string | null;
  faculteName: string | null;
  sourceLabel: string;
  isLinked: boolean;
  hasActiveEnrollment: boolean;
};

async function fetchUniversityLearners(branchId: string): Promise<UniversityLearner[]> {
  const [nativeStudents, links] = await Promise.all([
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
  ]);

  const learnerMap = new Map<string, UniversityLearner>();

  for (const student of nativeStudents) {
    const user = student.branchMember.member.user;
    const enrollment = student.classEnrollment[0];
    learnerMap.set(student.id, {
      studentId: student.id,
      nom: user?.name ?? "",
      postnom: user?.postnom ?? "",
      prenom: user?.prenom ?? "",
      username: user?.username ?? "",
      auditoireName: enrollment?.classe?.nameClasse ?? null,
      auditoireLevel: enrollment?.classe?.level ?? null,
      filiereName: enrollment?.classe?.option?.nameOption ?? null,
      faculteName: enrollment?.classe?.option?.section?.nameSection ?? null,
      sourceLabel: "Inscrit nativement",
      isLinked: false,
      hasActiveEnrollment: Boolean(enrollment),
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
      auditoireName: enrollment?.classe?.nameClasse ?? null,
      auditoireLevel: enrollment?.classe?.level ?? null,
      filiereName: enrollment?.classe?.option?.nameOption ?? null,
      faculteName: enrollment?.classe?.option?.section?.nameSection ?? null,
      sourceLabel: `Importe · ${link.sourceBranch.name}`,
      isLinked: true,
      hasActiveEnrollment: Boolean(enrollment),
    });
  }

  return Array.from(learnerMap.values());
}

export async function getUniversityRelevesAction() {
  const { branchId, organizationId, canIssueDocuments, typebranch } =
    await getCurrentBranch();

  if (!isUniversiteBranch(typebranch)) {
    return { ok: false as const, message: "Page reservee aux universites" };
  }

  const [learners, documents, branch] = await Promise.all([
    fetchUniversityLearners(branchId),
    prisma.issuedDocument.findMany({
      where: { branchId, documentType: "RELEVE_NOTES" },
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
          select: { nameYear: true },
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
    learners,
    documents: documents.map((doc) => ({
      id: doc.id,
      studentId: doc.studentId,
      title: doc.title,
      issuedAt: doc.issuedAt.toISOString(),
      metadata: doc.metadata,
    })),
  };
}

export async function issueReleveNotesAction(input: {
  studentId: string;
  semesterOrder?: number;
}) {
  const { branchId, organizationId, canIssueDocuments, typebranch } =
    await getCurrentBranch();

  if (!canIssueDocuments || !isUniversiteBranch(typebranch)) {
    return { ok: false as const, message: "Action non autorisee" };
  }

  const hasAccess = await studentHasBranchAccess(input.studentId, branchId);
  if (!hasAccess) {
    return { ok: false as const, message: "Etudiant introuvable dans cette branche" };
  }

  const releveData = await buildReleveNotesData({
    studentId: input.studentId,
    branchId,
    typebranch,
    semesterOrder: input.semesterOrder,
  });

  if (!releveData || releveData.semesters.length === 0) {
    return {
      ok: false as const,
      message: "Aucune note disponible pour generer le releve",
    };
  }

  const [branch, releveNumber] = await Promise.all([
    prisma.branch.findUnique({
      where: { id: branchId },
      select: { name: true, organization: { select: { name: true } } },
    }),
    generateReleveNumber(branchId),
  ]);

  if (!branch) {
    return { ok: false as const, message: "Branche introuvable" };
  }

  const semesterLabel =
    input.semesterOrder !== undefined
      ? releveData.semesters.find((s) => s.semesterOrder === input.semesterOrder)
          ?.semesterLabel
      : "Annuel";

  const duplicate = await findDuplicateIssuedDocument({
    branchId,
    studentId: input.studentId,
    schoolYearId: releveData.schoolYearId,
    documentType: "RELEVE_NOTES",
    metadata: {
      semesterOrder: input.semesterOrder ?? null,
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
      schoolYearId: releveData.schoolYearId,
      documentType: "RELEVE_NOTES",
      title: `Releve de notes - ${semesterLabel ?? "Annuel"}`,
      metadata: {
        releveNumber,
        semesterOrder: input.semesterOrder ?? null,
        semesterLabel: semesterLabel ?? null,
        overallAverage: releveData.overallAverage,
        studentName: releveData.studentName,
      },
    },
  });

  revalidateUniversityPages(organizationId, branchId);

  return {
    ok: true as const,
    document: {
      id: document.id,
      releveNumber,
      title: document.title,
      issuedAt: document.issuedAt.toISOString(),
      organizationName: branch.organization.name,
      branchName: branch.name,
      releveData,
    },
  };
}

export async function previewReleveNotesAction(input: {
  studentId: string;
  semesterOrder?: number;
}) {
  const { branchId, typebranch } = await getCurrentBranch();

  if (!isUniversiteBranch(typebranch)) {
    return { ok: false as const, message: "Action non autorisee" };
  }

  const hasAccess = await studentHasBranchAccess(input.studentId, branchId);
  if (!hasAccess) {
    return { ok: false as const, message: "Etudiant introuvable" };
  }

  const releveData = await buildReleveNotesData({
    studentId: input.studentId,
    branchId,
    typebranch,
    semesterOrder: input.semesterOrder,
  });

  if (!releveData) {
    return { ok: false as const, message: "Inscription active introuvable" };
  }

  return { ok: true as const, releveData };
}

export async function getUniversityAttestationsAction() {
  const { branchId, organizationId, canIssueDocuments, typebranch } =
    await getCurrentBranch();

  if (!isUniversiteBranch(typebranch)) {
    return { ok: false as const, message: "Page reservee aux universites" };
  }

  const [learners, documents, branch] = await Promise.all([
    fetchUniversityLearners(branchId),
    prisma.issuedDocument.findMany({
      where: {
        branchId,
        documentType: { in: ["ATTESTATION", "ATTESTATION_PARTICIPATION"] },
      },
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
          select: { nameYear: true },
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
    learners: learners.filter((learner) => learner.hasActiveEnrollment),
    documents,
    attestationKinds: UNIVERSITY_ATTESTATION_KINDS.map((kind) => ({
      value: kind,
      label: UNIVERSITY_ATTESTATION_LABELS[kind],
    })),
  };
}

export async function issueUniversityAttestationAction(input: {
  studentId: string;
  kind: UniversityAttestationKind;
  semesterLabel?: string;
}) {
  const { branchId, organizationId, canIssueDocuments, typebranch } =
    await getCurrentBranch();

  if (!canIssueDocuments || !isUniversiteBranch(typebranch)) {
    return { ok: false as const, message: "Action non autorisee" };
  }

  if (!UNIVERSITY_ATTESTATION_KINDS.includes(input.kind)) {
    return { ok: false as const, message: "Type d'attestation invalide" };
  }

  const hasAccess = await studentHasBranchAccess(input.studentId, branchId);
  if (!hasAccess) {
    return { ok: false as const, message: "Etudiant introuvable" };
  }

  const enrollment = await prisma.classEnrollment.findFirst({
    where: {
      studentId: input.studentId,
      branchId,
      statusEnrollment: true,
      schoolYear: { isCurrentYear: true },
    },
    include: {
      schoolYear: true,
      classe: {
        include: {
          option: { include: { section: true } },
        },
      },
    },
  });

  if (!enrollment) {
    return {
      ok: false as const,
      message: "L'etudiant doit etre inscrit a un auditoire actif",
    };
  }

  if (!enrollment.classe) {
    return {
      ok: false as const,
      message: "Auditoire d'inscription introuvable",
    };
  }

  const classe = enrollment.classe;

  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    include: {
      branchMember: { include: { member: { include: { user: true } } } },
    },
  });

  if (!student) {
    return { ok: false as const, message: "Etudiant introuvable" };
  }

  const user = student.branchMember.member.user;
  const studentName = [user?.name, user?.postnom, user?.prenom]
    .filter(Boolean)
    .join(" ");
  const title = UNIVERSITY_ATTESTATION_LABELS[input.kind];

  const duplicate = await findDuplicateIssuedDocument({
    branchId,
    studentId: input.studentId,
    schoolYearId: enrollment.schoolYearId,
    documentType: "ATTESTATION",
    metadata: {
      attestationKind: input.kind,
      semesterLabel:
        input.kind === "REUSSITE_SEMESTRE" ? input.semesterLabel ?? null : null,
    },
  });

  if (duplicate) {
    return {
      ok: false as const,
      message: duplicateDocumentMessage(duplicate.title),
    };
  }

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { name: true, organization: { select: { name: true } } },
  });

  const document = await prisma.issuedDocument.create({
    data: {
      branchId,
      studentId: input.studentId,
      schoolYearId: enrollment.schoolYearId,
      documentType: "ATTESTATION",
      title,
      metadata: {
        attestationKind: input.kind,
        semesterLabel: input.semesterLabel ?? null,
        studentName,
        auditoireName: classe.nameClasse,
        filiereName: classe.option?.nameOption ?? null,
        faculteName: classe.option?.section?.nameSection ?? null,
      },
    },
  });

  revalidateUniversityPages(organizationId, branchId);

  return {
    ok: true as const,
    document: {
      id: document.id,
      title: document.title,
      issuedAt: document.issuedAt.toISOString(),
      kind: input.kind,
      organizationName: branch?.organization.name ?? "",
      branchName: branch?.name ?? "",
      schoolYearName: enrollment.schoolYear.nameYear,
      studentName,
      username: user?.username ?? "",
      auditoireName: classe.nameClasse,
      filiereName: classe.option?.nameOption ?? null,
      faculteName: classe.option?.section?.nameSection ?? null,
      semesterLabel: input.semesterLabel ?? null,
    },
  };
}
