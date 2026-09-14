import { canManageOrganization } from "@/lib/auth/session-roles";
import { canAccessBranchAreaFromPermissions } from "@/lib/auth/resolve-branch-area-permission";
import {
  hasFicheAreaMatrixAccess,
  hasFicheAreaTemporaryGrant,
} from "@/lib/auth/fiche-area-access";
import { canAccessBranchAreaViaTemporaryGrants } from "@/lib/auth/temporary-privilege";
import { prisma } from "@/lib/prisma";
import { activeTitulaireTeachingWhere } from "@/lib/auth/titulaire-teaching";

/** Titulaire de cette classe (année courante, avec cours). */
export async function isTitulaireOfClass(params: {
  userId: string;
  branchId: string;
  classId: string;
}): Promise<boolean> {
  const teaching = await prisma.teaching.findFirst({
    where: {
      ...activeTitulaireTeachingWhere(params.branchId),
      classeId: params.classId,
      teacher: {
        isActive: true,
        branchMember: {
          branchId: params.branchId,
          isActive: true,
          member: { userId: params.userId },
        },
      },
    },
    select: { id: true },
  });
  return Boolean(teaching);
}

export function hasFicheCoteMatrixAccess(session: unknown): boolean {
  return (
    canAccessBranchAreaFromPermissions("fiche_cote", session) ||
    hasFicheAreaMatrixAccess(session)
  );
}

export async function hasFicheCoteTemporaryGrant(params: {
  userId: string;
  organizationId: string;
  branchId?: string | null;
}): Promise<boolean> {
  const [ficheCote, ficheArea] = await Promise.all([
    canAccessBranchAreaViaTemporaryGrants(
      params.userId,
      params.organizationId,
      "fiche_cote",
      params.branchId,
    ),
    hasFicheAreaTemporaryGrant(params),
  ]);
  return ficheCote || ficheArea;
}

/**
 * Type « Fiche » (ficheCote) + périodes complètes (examens) :
 * manager, titulaire de la classe, matrice / octroi ficheCote|fiches|ficheCentrale.
 */
export async function canUseFicheCoteForClass(params: {
  session: unknown;
  userId: string;
  organizationId: string;
  branchId: string;
  classId: string;
}): Promise<boolean> {
  if (canManageOrganization(params.session)) return true;
  if (
    await isTitulaireOfClass({
      userId: params.userId,
      branchId: params.branchId,
      classId: params.classId,
    })
  ) {
    return true;
  }
  if (hasFicheCoteMatrixAccess(params.session)) return true;
  return hasFicheCoteTemporaryGrant({
    userId: params.userId,
    organizationId: params.organizationId,
    branchId: params.branchId,
  });
}
