"use server";

import { z } from "zod";
import { action } from "@/lib/zsa";
import { prisma } from "@/lib/prisma";
import {
  getNotificationBadgeCounts,
  requireNotificationContext,
} from "@/lib/notifications/badge-counts";
import { listUnreadAppNotifications } from "@/lib/attendance-absence";
import { Prisma } from "@/prisma/generated/prisma/client";

// ─── types ────────────────────────────────────────────────────────────────────
export type NotificationRequestRow = {
  id: string;
  reference: string;
  status: string;
  studentData: Prisma.JsonValue;
  guardiansData: Prisma.JsonValue;
  requestedLevel: string | null;
  requestedOption: string | null;
  photoUrl: string | null;
  schoolYearId: string | null;
  createdAt: Date;
};

export type NotificationJobApplicationRow = {
  id: string;
  reference: string;
  status: string;
  applicationType: string;
  nom: string;
  postnom: string;
  prenom: string;
  photoUrl: string | null;
  desiredOrgRole: string | null;
  desiredSubjects: string | null;
  createdAt: Date;
};

export type NotificationAppRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  absenceCaseId: string | null;
  gradeModificationRequestId: string | null;
  conversationId: string | null;
  href: string | null;
  case: {
    id: string;
    status: string;
    subjectType: string;
    contextLabel: string;
    occurredOn: string;
    personName: string;
    justification: string | null;
    reviewComment: string | null;
    justifiedAt: string | null;
    reviewedAt: string | null;
  } | null;
};

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

function personName(user: {
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

async function fetchLegacyNotificationItems(params: {
  branchId: string;
  organizationId: string;
  canSeeInscriptions: boolean;
  canSeeCandidatures: boolean;
}) {
  const [registrations, jobApplications] = await Promise.all([
    params.canSeeInscriptions
      ? prisma.$queryRaw<NotificationRequestRow[]>(Prisma.sql`
          SELECT "id", "reference", "status"::text, "studentData", "guardiansData",
            "requestedLevel", "requestedOption", "photoUrl", "schoolYearId", "createdAt"
          FROM "RegistrationRequest"
          WHERE "branchId" = ${params.branchId} AND "organizationId" = ${params.organizationId}
            AND "status" IN ('PENDING'::"RegistrationRequestStatus", 'CONFIRMED'::"RegistrationRequestStatus")
          ORDER BY "createdAt" DESC LIMIT 20
        `)
      : Promise.resolve([] as NotificationRequestRow[]),
    params.canSeeCandidatures
      ? prisma.jobApplication.findMany({
          where: {
            branchId: params.branchId,
            organizationId: params.organizationId,
            status: { in: ["PENDING", "REVIEWED"] },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            reference: true,
            status: true,
            applicationType: true,
            nom: true,
            postnom: true,
            prenom: true,
            photoUrl: true,
            desiredOrgRole: true,
            desiredSubjects: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  return {
    registrations,
    jobApplications: jobApplications as NotificationJobApplicationRow[],
  };
}

// ─── action : demandes inscription + candidatures (max 20) ───────────────────
export const getNotificationRequestsAction = action.handler(async () => {
  const {
    branchId,
    organizationId,
    canSeeInscriptions,
    canSeeCandidatures,
  } = await requireNotificationContext();

  const legacy = await fetchLegacyNotificationItems({
    branchId,
    organizationId,
    canSeeInscriptions,
    canSeeCandidatures,
  });

  return {
    ...legacy,
    canSeeInscriptions,
    canSeeCandidatures,
  };
});

/** Flux unique de la cloche : mêmes éléments que le badge, sans dossiers d'absence annexes. */
export const getNotificationInboxAction = action.handler(async () => {
  const {
    branchId,
    organizationId,
    userId,
    canSeeInscriptions,
    canSeeCandidatures,
  } = await requireNotificationContext();

  const [legacy, unread] = await Promise.all([
    fetchLegacyNotificationItems({
      branchId,
      organizationId,
      canSeeInscriptions,
      canSeeCandidatures,
    }),
    listUnreadAppNotifications({
      branchId,
      userId,
      organizationId,
    }),
  ]);

  const { registrations, jobApplications } = legacy;

  const notifications: NotificationAppRow[] = unread.map((row) => {
    const occurredOn = toIso(row.absenceCase?.occurredOn);
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      createdAt: toIso(row.createdAt) ?? new Date(0).toISOString(),
      absenceCaseId: row.absenceCaseId,
      gradeModificationRequestId: row.gradeModificationRequestId,
      conversationId: row.conversationId,
      href: row.href,
      case:
        row.absenceCase && occurredOn
          ? {
              id: row.absenceCase.id,
              status: row.absenceCase.status,
              subjectType: row.absenceCase.subjectType,
              contextLabel: row.absenceCase.contextLabel,
              occurredOn,
              personName: personName(row.absenceCase.user),
              justification: row.absenceCase.justification,
              reviewComment: row.absenceCase.reviewComment,
              justifiedAt: toIso(row.absenceCase.justifiedAt),
              reviewedAt: toIso(row.absenceCase.reviewedAt),
            }
          : null,
    };
  });

  return {
    registrations,
    jobApplications: jobApplications as NotificationJobApplicationRow[],
    notifications,
  };
});

// ─── action : count rapide pour le badge ──────────────────────────────────────
export const getNotificationCountAction = action.handler(async () => {
  return getNotificationBadgeCounts();
});

// ─── action : confirmer une demande ───────────────────────────────────────────
export const confirmNotificationRequestAction = action
  .input(z.object({ requestId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const { branchId, organizationId, userId, canSeeInscriptions } =
      await requireNotificationContext();
    if (!canSeeInscriptions) {
      throw new Error("Accès non autorisé aux demandes d'inscription.");
    }
    const updated = await prisma.$executeRaw(Prisma.sql`
      UPDATE "RegistrationRequest"
      SET "status" = 'CONFIRMED'::"RegistrationRequestStatus",
          "confirmedAt" = NOW(), "confirmedById" = ${userId}, "updatedAt" = NOW()
      WHERE "id" = ${input.requestId} AND "branchId" = ${branchId}
        AND "organizationId" = ${organizationId}
        AND "status" = 'PENDING'::"RegistrationRequestStatus"
    `);
    if (updated !== 1) {
      const existing = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id" FROM "RegistrationRequest"
        WHERE "id" = ${input.requestId} AND "branchId" = ${branchId}
          AND "organizationId" = ${organizationId}
          AND "status" = 'CONFIRMED'::"RegistrationRequestStatus" LIMIT 1
      `);
      if (!existing[0]) throw new Error("Cette demande n'est plus disponible.");
    }
    return { requestId: input.requestId };
  });

// ─── action : rejeter une demande d'inscription (retire la notif) ──────────────
export const rejectNotificationRequestAction = action
  .input(
    z.object({
      requestId: z.string().min(1),
      reason: z.string().trim().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId, canSeeInscriptions } =
      await requireNotificationContext();
    if (!canSeeInscriptions) {
      throw new Error("Accès non autorisé aux demandes d'inscription.");
    }
    const reason = input.reason?.trim() || null;
    const updated = await prisma.$executeRaw(Prisma.sql`
      UPDATE "RegistrationRequest"
      SET "status" = 'REJECTED'::"RegistrationRequestStatus",
          "rejectedReason" = ${reason},
          "updatedAt" = NOW()
      WHERE "id" = ${input.requestId} AND "branchId" = ${branchId}
        AND "organizationId" = ${organizationId}
        AND "status" IN (
          'PENDING'::"RegistrationRequestStatus",
          'CONFIRMED'::"RegistrationRequestStatus"
        )
    `);
    if (updated !== 1) {
      throw new Error("Cette demande n'est plus disponible.");
    }
    return { requestId: input.requestId };
  });
