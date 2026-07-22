import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { guardOrganizationBranchAccess } from "@/lib/auth/require-organization-permission";
import { setActiveOrganizationAndBranch } from "@/lib/auth/set-active-context";
import { prisma } from "@/lib/prisma";

/**
 * Active une branche sur la session courante.
 * Fonction serveur normale (pas une Server Action) — appelable depuis un RSC.
 */
export async function switchActiveBranch(
  organizationId: string,
  branchId: string,
): Promise<{ ok: true } | { ok: false; message: string; notFound?: boolean }> {
  const guard = await guardOrganizationBranchAccess(organizationId, branchId);
  if (!guard.ok) {
    return {
      ok: false,
      message: guard.message,
      // Seule une branche absente doit être traitée comme 404 côté pages.
      notFound: guard.message === "Etablissement introuvable.",
    };
  }

  const requestHeaders = await headers();
  const session = await auth.api.getSession({
    headers: requestHeaders,
  });

  if (!session?.session?.id || !session.user?.id) {
    return { ok: false, message: "Session introuvable" };
  }

  const branch = await prisma.branch.findFirst({
    where: {
      id: branchId,
      organizationId,
    },
    select: { id: true },
  });

  if (!branch) {
    return {
      ok: false,
      message: "Branche introuvable dans cette organisation",
      notFound: true,
    };
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
      error instanceof Error ? error.message : "Activation de branche impossible";
    console.error("[switchActiveBranch]", message, error);
    return { ok: false, message };
  }

  return { ok: true };
}
