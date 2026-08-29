"use server";

import { z } from "zod";
import { action } from "@/lib/zsa";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { canReviewAbsenceJustifications } from "@/lib/auth/session-roles";
import { prisma } from "@/lib/prisma";
import {
  getAbsenceCaseForUser,
  listMyAbsenceCases,
  listPendingAbsenceReviews,
  listUnreadAppNotifications,
  markAppNotificationRead,
  reviewAbsenceJustification,
  signalEndedAbsencesForBranchDebounced,
  submitAbsenceJustification,
} from "@/lib/attendance-absence";

function formatPersonName(user: {
  prenom?: string | null;
  name?: string | null;
  postnom?: string | null;
} | null) {
  if (!user) return "Utilisateur";
  return (
    [user.prenom, user.name, user.postnom].filter(Boolean).join(" ").trim() ||
    user.name ||
    "Utilisateur"
  );
}

export const getAbsenceInboxAction = action.handler(async () => {
  const { branchId, userId, session } = await requireBranchContext();
  void signalEndedAbsencesForBranchDebounced(branchId).catch((error) => {
    console.error("[getAbsenceInboxAction] signal", error);
  });

  const canReview = canReviewAbsenceJustifications(session);
  const [mine, pending, notifications] = await Promise.all([
    listMyAbsenceCases({ branchId, userId }),
    canReview ? listPendingAbsenceReviews({ branchId }) : Promise.resolve([]),
    listUnreadAppNotifications({ branchId, userId }),
  ]);

  return {
    canReview,
    mine,
    pending,
    notifications: notifications.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      createdAt: row.createdAt,
      absenceCaseId: row.absenceCaseId,
      gradeModificationRequestId: row.gradeModificationRequestId,
      case: row.absenceCase
        ? {
            id: row.absenceCase.id,
            status: row.absenceCase.status,
            subjectType: row.absenceCase.subjectType,
            contextLabel: row.absenceCase.contextLabel,
            occurredOn: row.absenceCase.occurredOn.toISOString(),
            personName: formatPersonName(row.absenceCase.user),
            justification: row.absenceCase.justification,
            reviewComment: row.absenceCase.reviewComment,
            justifiedAt: row.absenceCase.justifiedAt?.toISOString() ?? null,
            reviewedAt: row.absenceCase.reviewedAt?.toISOString() ?? null,
          }
        : null,
    })),
  };
});

export const getAbsenceDashboardAction = action.handler(async () => {
  const { branchId, userId, session } = await requireBranchContext();
  void signalEndedAbsencesForBranchDebounced(branchId).catch((error) => {
    console.error("[getAbsenceDashboardAction] signal", error);
  });
  const canReview = canReviewAbsenceJustifications(session);
  const [mine, pending] = await Promise.all([
    listMyAbsenceCases({ branchId, userId }),
    canReview ? listPendingAbsenceReviews({ branchId }) : Promise.resolve([]),
  ]);
  return { canReview, mine, pending };
});

export const getAbsenceCaseAction = action
  .input(z.object({ caseId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const { branchId, userId, session } = await requireBranchContext();
    const asReviewer = canReviewAbsenceJustifications(session);
    const row = await getAbsenceCaseForUser({
      caseId: input.caseId,
      branchId,
      userId,
      asReviewer,
    });
    if (!row) throw new Error("Dossier d'absence introuvable.");
    return { canReview: asReviewer, case: row };
  });

export const submitAbsenceJustificationAction = action
  .input(
    z.object({
      caseId: z.string().min(1),
      justification: z.string().trim().min(8).max(2000),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, userId } = await requireBranchContext();
    await submitAbsenceJustification({
      caseId: input.caseId,
      userId,
      branchId,
      justification: input.justification,
    });
    return { ok: true };
  });

export const reviewAbsenceJustificationAction = action
  .input(
    z.object({
      caseId: z.string().min(1),
      decision: z.enum(["ACCEPTED", "REJECTED"]),
      comment: z.string().trim().max(1000).optional(),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, userId, session } = await requireBranchContext();
    const member = await prisma.branchMember.findFirst({
      where: {
        branchId,
        member: { userId },
      },
      select: { role: true },
    });
    if (!canReviewAbsenceJustifications(session, member?.role)) {
      throw new Error("Vous n'êtes pas habilité à traiter les justifications.");
    }
    await reviewAbsenceJustification({
      caseId: input.caseId,
      branchId,
      reviewerId: userId,
      decision: input.decision,
      comment: input.comment,
    });
    return { ok: true };
  });

export const markAbsenceNotificationReadAction = action
  .input(z.object({ notificationId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const { branchId, userId } = await requireBranchContext();
    await markAppNotificationRead({
      notificationId: input.notificationId,
      userId,
      branchId,
    });
    return { ok: true };
  });
