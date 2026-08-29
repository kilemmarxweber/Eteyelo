import { prisma } from "@/lib/prisma";
import { getBranchAbsenceReviewers } from "@/lib/email/get-branch-manager-emails";
import { nowLocal } from "@/lib/timezone";
import type { AppNotificationType } from "@/prisma/generated/prisma/client";
import type { GradeModificationView } from "@/lib/grade-modification-shared";

export type { GradeModificationView } from "@/lib/grade-modification-shared";

const userContactSelect = {
  id: true,
  email: true,
  telephone: true,
  name: true,
  prenom: true,
  postnom: true,
} as const;

function formatPersonName(user: {
  name: string;
  prenom: string | null;
  postnom: string | null;
} | null | undefined) {
  if (!user) return "Utilisateur";
  return (
    [user.prenom, user.name, user.postnom].filter(Boolean).join(" ").trim() ||
    user.name ||
    "Utilisateur"
  );
}

async function createAppNotification(input: {
  branchId: string;
  userId: string;
  type: AppNotificationType;
  title: string;
  body: string;
  href?: string;
  gradeModificationRequestId: string;
}) {
  return prisma.appNotification.create({ data: input });
}

export async function submitGradeModificationRequest(params: {
  ficheId: string;
  branchId: string;
  userId: string;
  justification: string;
  evidenceUrl: string;
  proposedNotes: unknown;
}) {
  const text = params.justification.trim();
  if (text.length < 8) {
    throw new Error("Expliquez le motif de la modification (au moins 8 caractères).");
  }
  const evidenceUrl = params.evidenceUrl.trim();
  if (!evidenceUrl) {
    throw new Error("Ajoutez une photo ou une capture pour justifier la modification.");
  }

  const fiche = await prisma.fiche.findFirst({
    where: { id: params.ficheId, branchId: params.branchId },
    select: {
      id: true,
      status: true,
      notes: true,
      typeFiche: true,
      coursName: true,
      classeName: true,
      periodeName: true,
      teacherId: true,
      branch: { select: { name: true, organizationId: true } },
      teacher: {
        select: {
          branchMember: {
            select: { member: { select: { userId: true } } },
          },
        },
      },
    },
  });

  if (!fiche) throw new Error("Fiche introuvable.");
  if (fiche.status) {
    throw new Error("Cette fiche est validée : modification impossible.");
  }

  const teacherUserId = fiche.teacher.branchMember?.member?.userId;
  if (teacherUserId && teacherUserId !== params.userId) {
    // Les admins / reviewers peuvent aussi soumettre pour un enseignant ;
    // on autorise si l'utilisateur est le titulaire OU si on laisse passer
    // (contrôle accès fait côté action).
  }

  const pending = await prisma.gradeModificationRequest.findFirst({
    where: {
      ficheId: fiche.id,
      status: "PENDING_REVIEW",
    },
    select: { id: true },
  });
  if (pending) {
    throw new Error(
      "Une demande de modification est déjà en attente pour cette fiche.",
    );
  }

  const proposedNotes = JSON.stringify(params.proposedNotes);
  const contextLabel = `${fiche.typeFiche} · ${fiche.coursName} · ${fiche.classeName} · ${fiche.periodeName}`;

  const created = await prisma.gradeModificationRequest.create({
    data: {
      branchId: params.branchId,
      organizationId: fiche.branch.organizationId,
      ficheId: fiche.id,
      requestedById: params.userId,
      status: "PENDING_REVIEW",
      justification: text,
      evidenceUrl,
      previousNotes: fiche.notes,
      proposedNotes,
      contextLabel,
    },
    include: {
      requestedBy: { select: userContactSelect },
      branch: { select: { name: true, organizationId: true } },
    },
  });

  const requesterName = formatPersonName(created.requestedBy);
  const href = `/admin/organizations/${fiche.branch.organizationId}/branches/${params.branchId}/notes`;

  // L'enseignant ne reçoit pas de notif à l'envoi — seulement le retour (accepté/refusé).
  const reviewers = await getBranchAbsenceReviewers({
    branchId: params.branchId,
    organizationId: fiche.branch.organizationId,
  });

  await Promise.all(
    reviewers
      .filter((r) => r.userId !== params.userId)
      .map((reviewer) =>
        createAppNotification({
          branchId: params.branchId,
          userId: reviewer.userId,
          type: "GRADE_MODIFICATION_SUBMITTED",
          title: "Modification de notes à valider",
          body: `${requesterName} · ${contextLabel}`,
          href,
          gradeModificationRequestId: created.id,
        }),
      ),
  );

  return created;
}

export async function reviewGradeModificationRequest(params: {
  requestId: string;
  branchId: string;
  reviewerId: string;
  decision: "ACCEPTED" | "REJECTED";
  comment?: string;
}) {
  const request = await prisma.gradeModificationRequest.findFirst({
    where: { id: params.requestId, branchId: params.branchId },
    include: {
      requestedBy: { select: userContactSelect },
      fiche: { select: { id: true, status: true } },
      branch: { select: { name: true, organizationId: true } },
    },
  });

  if (!request) throw new Error("Demande introuvable.");
  if (request.status !== "PENDING_REVIEW") {
    throw new Error("Cette demande a déjà été traitée.");
  }

  if (params.decision === "ACCEPTED") {
    if (request.fiche.status) {
      throw new Error(
        "La fiche a été validée entre-temps : impossible d'appliquer la modification.",
      );
    }
    await prisma.fiche.update({
      where: { id: request.ficheId },
      data: {
        notes: request.proposedNotes,
        dateUpdated: nowLocal(),
      },
    });
  }

  const updated = await prisma.gradeModificationRequest.update({
    where: { id: request.id },
    data: {
      status: params.decision,
      reviewComment: params.comment?.trim() || null,
      reviewedById: params.reviewerId,
      reviewedAt: nowLocal(),
    },
  });

  await prisma.appNotification.updateMany({
    where: {
      gradeModificationRequestId: request.id,
      userId: params.reviewerId,
      readAt: null,
    },
    data: { readAt: nowLocal() },
  });

  const accepted = params.decision === "ACCEPTED";
  const href = `/admin/organizations/${request.branch.organizationId}/branches/${params.branchId}/notes`;

  await createAppNotification({
    branchId: params.branchId,
    userId: request.requestedById,
    type: "GRADE_MODIFICATION_DECISION",
    title: accepted ? "Modification de notes acceptée" : "Modification de notes refusée",
    body: accepted
      ? `${request.contextLabel} — les notes ont été mises à jour.`
      : `${request.contextLabel} — aucun changement appliqué.`,
    href,
    gradeModificationRequestId: request.id,
  });

  return updated;
}

export async function getGradeModificationRequestView(params: {
  requestId: string;
  branchId: string;
}): Promise<GradeModificationView | null> {
  const row = await prisma.gradeModificationRequest.findFirst({
    where: { id: params.requestId, branchId: params.branchId },
    include: {
      requestedBy: { select: userContactSelect },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    contextLabel: row.contextLabel,
    justification: row.justification,
    evidenceUrl: row.evidenceUrl,
    previousNotes: row.previousNotes,
    proposedNotes: row.proposedNotes,
    reviewComment: row.reviewComment,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    requesterName: formatPersonName(row.requestedBy),
    ficheId: row.ficheId,
  };
}

export async function listPendingGradeModificationsForReviewer(params: {
  branchId: string;
  userId: string;
}): Promise<GradeModificationView[]> {
  const rows = await prisma.gradeModificationRequest.findMany({
    where: {
      branchId: params.branchId,
      status: "PENDING_REVIEW",
    },
    include: {
      requestedBy: { select: userContactSelect },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    contextLabel: row.contextLabel,
    justification: row.justification,
    evidenceUrl: row.evidenceUrl,
    previousNotes: row.previousNotes,
    proposedNotes: row.proposedNotes,
    reviewComment: row.reviewComment,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    requesterName: formatPersonName(row.requestedBy),
    ficheId: row.ficheId,
  }));
}
