"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { setActiveOrganizationAndBranch } from "@/lib/auth/set-active-context";
import { guardOrganizationAccess } from "@/lib/auth/require-organization-permission";

/**
 * Restaure l'organisation / branche actives après un re-login
 * depuis le soft-lock de session (nouvelle session Better Auth).
 */
export async function restoreSessionLockContextAction(params: {
  organizationId: string | null;
  branchId: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { organizationId, branchId } = params;
  if (!organizationId) {
    return { ok: true };
  }

  const guard = await guardOrganizationAccess(organizationId);
  if (!guard.ok) {
    return { ok: false, message: guard.message };
  }

  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.session?.id || !session.user?.id) {
    return { ok: false, message: "Session introuvable." };
  }

  try {
    await setActiveOrganizationAndBranch({
      organizationId,
      branchId,
      userId: session.user.id,
      appRole: guard.context.appRole,
      sessionId: session.session.id,
      requestHeaders,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de restaurer le contexte de session.";
    return { ok: false, message };
  }

  return { ok: true };
}
