"use server";

import { z } from "zod";
import { action } from "@/lib/zsa";
import { prisma } from "@/lib/prisma";
import {
  getNotificationBadgeCounts,
  requireNotificationContext,
} from "@/lib/notifications/badge-counts";
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

// ─── action : demandes inscription + candidatures (max 20) ───────────────────
export const getNotificationRequestsAction = action.handler(async () => {
  const {
    branchId,
    organizationId,
    canSeeInscriptions,
    canSeeCandidatures,
  } = await requireNotificationContext();

  const [registrations, jobApplications] = await Promise.all([
    canSeeInscriptions
      ? prisma.$queryRaw<NotificationRequestRow[]>(Prisma.sql`
          SELECT "id", "reference", "status"::text, "studentData", "guardiansData",
            "requestedLevel", "requestedOption", "photoUrl", "schoolYearId", "createdAt"
          FROM "RegistrationRequest"
          WHERE "branchId" = ${branchId} AND "organizationId" = ${organizationId}
            AND "status" IN ('PENDING'::"RegistrationRequestStatus", 'CONFIRMED'::"RegistrationRequestStatus")
          ORDER BY "createdAt" DESC LIMIT 20
        `)
      : Promise.resolve([] as NotificationRequestRow[]),
    canSeeCandidatures
      ? prisma.jobApplication.findMany({
          where: {
            branchId,
            organizationId,
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
    canSeeInscriptions,
    canSeeCandidatures,
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
