import { Prisma } from "@/prisma/generated/prisma/client";

import {
  countUnreadAppNotifications,
  countUnreadMessageNotifications,
} from "@/lib/attendance-absence";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  canSeeCandidatureNotifications,
  canSeeInscriptionNotifications,
} from "@/lib/auth/session-roles";
import { prisma } from "@/lib/prisma";

export async function requireNotificationContext() {
  const context = await requireBranchContext();
  const branchMember = await prisma.branchMember.findFirst({
    where: {
      branchId: context.branchId,
      member: { userId: context.userId, organizationId: context.organizationId },
    },
    select: { role: true },
  });
  const memberRole = branchMember?.role;
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

/** Lecture seule : à appeler depuis une Route Handler, pas une Server Action. */
export async function getNotificationBadgeCounts() {
  const {
    branchId,
    organizationId,
    userId,
    canSeeInscriptions,
    canSeeCandidatures,
  } = await requireNotificationContext();

  const [registrationCount, jobCount, absenceCount, messagingCount] =
    await Promise.all([
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
      countUnreadAppNotifications({
        branchId,
        userId,
        organizationId,
      }),
      countUnreadMessageNotifications({ userId, organizationId }),
    ]);

  return {
    count: Number(registrationCount[0]?.count ?? 0) + jobCount + absenceCount,
    messagingCount,
  };
}
