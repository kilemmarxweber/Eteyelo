import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  isAppAdminRole,
  isPlatformOwnerRole,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * Active une organisation (et optionnellement une branche) sur la session.
 *
 * Better Auth `setActiveOrganization` exige un membership Member.
 * Owner plateforme / admin app : mise à jour Prisma directe.
 * Membres : tente Better Auth, puis synchronise toujours la Session Prisma
 * (filet de sécurité si l'API Better Auth échoue).
 */
export async function setActiveOrganizationAndBranch(params: {
  organizationId: string;
  branchId?: string | null;
  userId: string;
  appRole: string | null | undefined;
  sessionId: string;
  requestHeaders?: Headers;
}) {
  const {
    organizationId,
    branchId = null,
    appRole,
    sessionId,
  } = params;

  const requestHeaders = params.requestHeaders ?? (await headers());
  const canBypassMembership =
    isPlatformOwnerRole(appRole) || isAppAdminRole(appRole);

  if (!canBypassMembership) {
    try {
      await auth.api.setActiveOrganization({
        body: { organizationId },
        headers: requestHeaders,
      });
    } catch (error) {
      console.error(
        "[setActiveOrganizationAndBranch] setActiveOrganization failed, fallback Prisma:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      activeOrganizationId: organizationId,
      activeBranchId: branchId,
    },
  });
}
