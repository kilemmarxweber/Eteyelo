"use server";

import { headers } from "next/headers";

import { getCachedSession } from "@/lib/auth/get-session-cached";
import { setActiveOrganizationAndBranch } from "@/lib/auth/set-active-context";
import { guardOrganizationAccess } from "@/lib/auth/require-organization-permission";

/** Active l'organisation sur la session (compatible owner plateforme sans membership). */
export async function activateOrganizationSessionAction(organizationId: string) {
  const guard = await guardOrganizationAccess(organizationId);
  if (!guard.ok) {
    return { ok: false as const, message: guard.message };
  }

  const session = await getCachedSession();
  if (!session?.session?.id || !session.user?.id) {
    return { ok: false as const, message: "Session introuvable." };
  }

  // Déjà sur cette org : rien à écrire (évite un UPDATE session à chaque navigation).
  if (session.session.activeOrganizationId === organizationId) {
    return { ok: true as const, skipped: true as const };
  }

  await setActiveOrganizationAndBranch({
    organizationId,
    branchId: session.session.activeBranchId,
    userId: session.user.id,
    appRole: guard.context.appRole,
    sessionId: session.session.id,
    requestHeaders: await headers(),
  });

  return { ok: true as const };
}
