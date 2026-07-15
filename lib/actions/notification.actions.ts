"use server";

import { z } from "zod";
import { action } from "@/lib/zsa";
import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  canSeeBranchNotifications,
  canSeeCandidatureNotifications,
  canSeeInscriptionNotifications,
} from "@/lib/auth/session-roles";
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

// ─── helper ───────────────────────────────────────────────────────────────────
async function requireNotificationContext() {
  const context = await requireBranchContext();
  const branchMember = await prisma.branchMember.findFirst({
    where: {
      branchId: context.branchId,
      member: { userId: context.userId, organizationId: context.organizationId },
    },
    select: { role: true },
  });
  const memberRole = branchMember?.role;
  if (!canSeeBranchNotifications(context.session, memberRole)) {
    throw new Error("Accès non autorisé aux notifications.");
  }
  return {
    ...context,
    memberRole,
    canSeeInscriptions: canSeeInscriptionNotifications(
      context.session,
      memberRole,
    ),
    canSeeCandidatures: canSeeCandidatureNotifications(
      context.session,
      memberRole,
    ),
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
            status: { in: ["PENDING", "REVIEWED", "ACCEPTED"] },
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
  const {
    branchId,
    organizationId,
    canSeeInscriptions,
    canSeeCandidatures,
  } = await requireNotificationContext();

  const [registrationCount, jobCount] = await Promise.all([
    canSeeInscriptions
      ? prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
          SELECT COUNT(*) AS count
          FROM "RegistrationRequest"
          WHERE "branchId" = ${branchId} AND "organizationId" = ${organizationId}
            AND "status" = 'PENDING'::"RegistrationRequestStatus"
        `)
      : Promise.resolve([{ count: BigInt(0) }]),
    canSeeCandidatures
      ? prisma.jobApplication.count({
          where: {
            branchId,
            organizationId,
            status: { in: ["PENDING", "REVIEWED"] },
          },
        })
      : Promise.resolve(0),
  ]);

  return {
    count: Number(registrationCount[0]?.count ?? 0) + jobCount,
  };
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
