"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { setActiveOrganizationAndBranch } from "@/lib/auth/set-active-context";
import { guardOrganizationAccess } from "@/lib/auth/require-organization-permission";

/** Active l'organisation sur la session (compatible owner plateforme sans membership). */
export async function activateOrganizationSessionAction(organizationId: string) {
  const guard = await guardOrganizationAccess(organizationId);
  if (!guard.ok) {
    return { ok: false as const, message: guard.message };
  }

  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.session?.id || !session.user?.id) {
    return { ok: false as const, message: "Session introuvable." };
  }

  await setActiveOrganizationAndBranch({
    organizationId,
    branchId: session.session.activeBranchId,
    userId: session.user.id,
    appRole: guard.context.appRole,
    sessionId: session.session.id,
    requestHeaders,
  });

  return { ok: true as const };
}
