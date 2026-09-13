import { canAccessBranchAreaFromPermissions } from "@/lib/auth/resolve-branch-area-permission";
import { canAccessTitulaireFichesArea } from "@/lib/auth/session-roles";
import { canAccessBranchAreaViaTemporaryGrants } from "@/lib/auth/temporary-privilege";

/** Accès fiche centrale / fiches via la matrice des rôles (DAC). */
export function hasFicheAreaMatrixAccess(session: unknown): boolean {
  return (
    canAccessBranchAreaFromPermissions("fiche_centrale", session) ||
    canAccessBranchAreaFromPermissions("fiches", session)
  );
}

/** Accès fiche centrale / fiches via octroi temporaire. */
export async function hasFicheAreaTemporaryGrant(params: {
  userId: string;
  organizationId: string;
  branchId?: string | null;
}): Promise<boolean> {
  const [ficheCentrale, fiches] = await Promise.all([
    canAccessBranchAreaViaTemporaryGrants(
      params.userId,
      params.organizationId,
      "fiche_centrale",
      params.branchId,
    ),
    canAccessBranchAreaViaTemporaryGrants(
      params.userId,
      params.organizationId,
      "fiches",
      params.branchId,
    ),
  ]);
  return ficheCentrale || fiches;
}

/** Titulaire ou matrice (sans attendre l’octroi async). */
export function canSeeFicheAreaFromSession(session: unknown): boolean {
  return (
    canAccessTitulaireFichesArea(session) || hasFicheAreaMatrixAccess(session)
  );
}
