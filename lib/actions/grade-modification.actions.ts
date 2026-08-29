"use server";

import { z } from "zod";
import { action } from "@/lib/zsa";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  canManageOrganization,
  canReviewAbsenceJustifications,
  hasSessionRole,
} from "@/lib/auth/session-roles";
import { ORG_ROLE } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  getGradeModificationRequestView,
  listPendingGradeModificationsForReviewer,
  reviewGradeModificationRequest,
  submitGradeModificationRequest,
} from "@/lib/grade-modification";

const submitSchema = z.object({
  ficheId: z.string().min(1),
  justification: z.string().trim().min(8),
  evidenceUrl: z.string().trim().min(1),
  proposedNotes: z.array(z.record(z.unknown())),
});

const reviewSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["ACCEPTED", "REJECTED"]),
  comment: z.string().trim().optional(),
});

export const submitGradeModificationAction = action
  .input(submitSchema)
  .handler(async ({ input }) => {
    const { session, userId, branchId } = await requireBranchContext();
    const canTeacher = hasSessionRole(session, [ORG_ROLE.TEACHER, "TEACHER"]);
    const canManage = canManageOrganization(session);
    if (!canTeacher && !canManage) {
      throw new Error("Accès refusé.");
    }

    const created = await submitGradeModificationRequest({
      ficheId: input.ficheId,
      branchId,
      userId,
      justification: input.justification,
      evidenceUrl: input.evidenceUrl,
      proposedNotes: input.proposedNotes,
    });

    return { ok: true as const, requestId: created.id };
  });

export const reviewGradeModificationAction = action
  .input(reviewSchema)
  .handler(async ({ input }) => {
    const { session, userId, branchId } = await requireBranchContext();
    const member = await prisma.branchMember.findFirst({
      where: { branchId, member: { userId } },
      select: { role: true },
    });
    if (!canReviewAbsenceJustifications(session, member?.role)) {
      throw new Error("Vous n'êtes pas habilité à valider cette demande.");
    }

    await reviewGradeModificationRequest({
      requestId: input.requestId,
      branchId,
      reviewerId: userId,
      decision: input.decision,
      comment: input.comment,
    });

    return { ok: true as const };
  });

export const getGradeModificationAction = action
  .input(z.object({ requestId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const { branchId } = await requireBranchContext();
    const view = await getGradeModificationRequestView({
      requestId: input.requestId,
      branchId,
    });
    if (!view) throw new Error("Demande introuvable.");
    return view;
  });

export const listPendingGradeModificationsAction = action.handler(async () => {
  const { session, userId, branchId } = await requireBranchContext();
  if (!canReviewAbsenceJustifications(session)) {
    return [] as Awaited<
      ReturnType<typeof listPendingGradeModificationsForReviewer>
    >;
  }
  return listPendingGradeModificationsForReviewer({ branchId, userId });
});

export const getFicheScoresAction = action
  .input(z.object({ ficheId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const { session, userId, branchId } = await requireBranchContext();
    const canTeacher = hasSessionRole(session, [ORG_ROLE.TEACHER, "TEACHER"]);
    const canManage = canManageOrganization(session);
    if (!canTeacher && !canManage && !canReviewAbsenceJustifications(session)) {
      throw new Error("Accès refusé.");
    }

    const fiche = await prisma.fiche.findFirst({
      where: { id: input.ficheId, branchId },
      select: {
        id: true,
        status: true,
        notes: true,
        typeFiche: true,
        coursName: true,
        classeName: true,
        periodeName: true,
        dateCreated: true,
        teacherId: true,
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

    if (
      !canManage &&
      !canReviewAbsenceJustifications(session) &&
      fiche.teacher.branchMember?.member?.userId !== userId
    ) {
      throw new Error("Accès refusé à cette fiche.");
    }

    let notes: unknown[] = [];
    try {
      notes = JSON.parse(fiche.notes) as unknown[];
    } catch {
      notes = [];
    }

    const pending = await prisma.gradeModificationRequest.findFirst({
      where: { ficheId: fiche.id, status: "PENDING_REVIEW" },
      select: { id: true },
    });

    return {
      id: fiche.id,
      status: fiche.status,
      typeFiche: fiche.typeFiche,
      coursName: fiche.coursName,
      classeName: fiche.classeName,
      periodeName: fiche.periodeName,
      dateCreated: fiche.dateCreated.toISOString(),
      notes,
      pendingRequestId: pending?.id ?? null,
      isOpen: !fiche.status,
    };
  });
