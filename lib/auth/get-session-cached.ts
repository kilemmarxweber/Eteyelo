import { cache } from "react";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";

/**
 * Génération par requête RSC : permet d'invalider le cache session
 * après un switch org/branche dans la même requête (sinon React.cache
 * renvoie encore l'ancienne activeBranchId → data vide jusqu'au F5).
 */
const getSessionGeneration = cache(() => ({ current: 0 }));

const getSessionByGeneration = cache(async (generation: number) => {
  void generation;
  return auth.api.getSession({
    headers: await headers(),
  });
});

/**
 * Une seule résolution de session par génération (par défaut 1× par requête).
 * Après `invalidateCachedSession()`, le prochain appel refetch.
 */
export async function getCachedSession() {
  const generation = getSessionGeneration();
  return getSessionByGeneration(generation.current);
}

/** À appeler après écriture Prisma/Better Auth sur activeOrganizationId / activeBranchId. */
export function invalidateCachedSession() {
  const generation = getSessionGeneration();
  generation.current += 1;
}
