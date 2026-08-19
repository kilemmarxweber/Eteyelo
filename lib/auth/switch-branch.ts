import { getCachedSession } from "@/lib/auth/get-session-cached";
import { guardOrganizationBranchAccess } from "@/lib/auth/require-organization-permission";
import { setActiveOrganizationAndBranch } from "@/lib/auth/set-active-context";
import { headers } from "next/headers";

/**
 * Active une branche sur la session courante.
 * Skip l'écriture DB si la branche/org est déjà active.
 */
export async function switchActiveBranch(
  organizationId: string,
  branchId: string,
  options?: {
    /** Si true, saute le guard (déjà fait par le layout). */
    alreadyGuarded?: boolean;
    appRole?: string | null;
  },
): Promise<{ ok: true } | { ok: false; message: string; notFound?: boolean }> {
  const session = await getCachedSession();

  if (!session?.session?.id || !session.user?.id) {
    return { ok: false, message: "Session introuvable" };
  }

  const alreadyActive =
    session.session.activeOrganizationId === organizationId &&
    session.session.activeBranchId === branchId;

  // Déjà sur la bonne branche : pas de guard ni d'écriture (cas navigation interne).
  if (alreadyActive) {
    return { ok: true };
  }

  let appRole = options?.appRole ?? session.user.role ?? null;

  if (!options?.alreadyGuarded) {
    const guard = await guardOrganizationBranchAccess(organizationId, branchId);
    if (!guard.ok) {
      return {
        ok: false,
        message: guard.message,
        notFound: guard.message === "Etablissement introuvable.",
      };
    }
    appRole = guard.context.appRole;
  }

  try {
    await setActiveOrganizationAndBranch({
      organizationId,
      branchId,
      userId: session.user.id,
      appRole,
      sessionId: session.session.id,
      requestHeaders: await headers(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Activation de branche impossible";
    console.error("[switchActiveBranch]", message, error);
    return { ok: false, message };
  }

  return { ok: true };
}
