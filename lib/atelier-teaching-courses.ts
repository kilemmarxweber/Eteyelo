import { activeCoursStatusFilter } from "@/lib/active-cours";
import { getConfiguredCoursIdsForClasse } from "@/lib/course-ponderation";
import { prisma } from "@/lib/prisma";

export type AtelierConfiguredEmptyReason = "NO_SOURCE" | "NO_MATCHING_LINKS";

export type AtelierConfiguredCoursResult = {
  coursIds: string[];
  emptyReason: AtelierConfiguredEmptyReason | null;
};

export type AtelierCourseLinkRow = {
  atelierCoursId: string;
  secondaryCoursId: string;
  secondaryBranchId: string;
};

/**
 * Pure : cours atelier affectables pour un groupe.
 * 1) Liens dont le cours secondaire est dans le curriculum de la classe source
 * 2) Sinon : tous les liens vers la même école (branche) source
 */
export function resolveAtelierConfiguredParentIds(params: {
  sourceClasseId: string | null | undefined;
  sourceBranchId?: string | null;
  secondaryConfiguredCoursIds: Iterable<string>;
  atelierLinks: AtelierCourseLinkRow[];
}): AtelierConfiguredCoursResult {
  if (!params.sourceClasseId) {
    return { coursIds: [], emptyReason: "NO_SOURCE" };
  }

  const secondarySet = new Set(params.secondaryConfiguredCoursIds);
  const fromCurriculum = new Set<string>();
  for (const link of params.atelierLinks) {
    if (secondarySet.has(link.secondaryCoursId)) {
      fromCurriculum.add(link.atelierCoursId);
    }
  }
  if (fromCurriculum.size > 0) {
    return { coursIds: [...fromCurriculum], emptyReason: null };
  }

  const sourceBranchId = params.sourceBranchId?.trim() || null;
  if (sourceBranchId) {
    const fromSchool = new Set<string>();
    for (const link of params.atelierLinks) {
      if (link.secondaryBranchId === sourceBranchId) {
        fromSchool.add(link.atelierCoursId);
      }
    }
    if (fromSchool.size > 0) {
      return { coursIds: [...fromSchool], emptyReason: null };
    }
  }

  return { coursIds: [], emptyReason: "NO_MATCHING_LINKS" };
}

async function loadAtelierCourseLinks(
  atelierBranchId: string,
): Promise<AtelierCourseLinkRow[]> {
  const rows = await prisma.atelierCourseLink.findMany({
    where: {
      atelierCours: {
        branchId: atelierBranchId,
        ...activeCoursStatusFilter,
      },
    },
    select: {
      atelierCoursId: true,
      secondaryCoursId: true,
      secondaryBranchId: true,
    },
  });
  return rows.map((row) => ({
    atelierCoursId: row.atelierCoursId,
    secondaryCoursId: row.secondaryCoursId,
    secondaryBranchId: row.secondaryBranchId,
  }));
}

/**
 * Cours atelier (parents) affectables pour un groupe :
 * Groupe → classe source → curriculum / école secondaire → AtelierCourseLink.
 */
export async function getConfiguredCoursIdsForAtelierGroupe(params: {
  atelierBranchId: string;
  groupeId: string;
}): Promise<AtelierConfiguredCoursResult> {
  const groupe = await prisma.classe.findFirst({
    where: {
      id: params.groupeId,
      branchId: params.atelierBranchId,
    },
    select: {
      id: true,
      sourceClasseId: true,
      sourceClasse: {
        select: {
          id: true,
          optionId: true,
          level: true,
          branchId: true,
        },
      },
    },
  });

  if (!groupe) {
    return { coursIds: [], emptyReason: "NO_SOURCE" };
  }

  if (!groupe.sourceClasseId || !groupe.sourceClasse) {
    return { coursIds: [], emptyReason: "NO_SOURCE" };
  }

  const source = groupe.sourceClasse;
  const [secondaryConfigured, atelierLinks] = await Promise.all([
    getConfiguredCoursIdsForClasse({
      branchId: source.branchId,
      optionId: source.optionId,
      level: source.level,
    }),
    loadAtelierCourseLinks(params.atelierBranchId),
  ]);

  return resolveAtelierConfiguredParentIds({
    sourceClasseId: source.id,
    sourceBranchId: source.branchId,
    secondaryConfiguredCoursIds: secondaryConfigured,
    atelierLinks,
  });
}

type GroupeSourceRow = {
  id: string;
  sourceClasseId: string | null;
  sourceClasse: {
    id: string;
    optionId: string | null;
    level: string | null;
    branchId: string;
  } | null;
};

/**
 * Variante batch pour le workspace d'affectation (un map groupeId → résultat).
 */
export async function getConfiguredCoursIdsByAtelierGroupes(params: {
  atelierBranchId: string;
  groupes: GroupeSourceRow[];
}): Promise<Map<string, AtelierConfiguredCoursResult>> {
  const result = new Map<string, AtelierConfiguredCoursResult>();
  if (!params.groupes.length) return result;

  const atelierLinks = await loadAtelierCourseLinks(params.atelierBranchId);
  const curriculumCache = new Map<string, string[]>();

  async function secondaryConfiguredFor(
    source: NonNullable<GroupeSourceRow["sourceClasse"]>,
  ) {
    const key = `${source.branchId}:${source.optionId ?? ""}:${source.level ?? ""}`;
    const cached = curriculumCache.get(key);
    if (cached) return cached;
    const ids = await getConfiguredCoursIdsForClasse({
      branchId: source.branchId,
      optionId: source.optionId,
      level: source.level,
    });
    curriculumCache.set(key, ids);
    return ids;
  }

  for (const groupe of params.groupes) {
    if (!groupe.sourceClasseId || !groupe.sourceClasse) {
      result.set(groupe.id, { coursIds: [], emptyReason: "NO_SOURCE" });
      continue;
    }
    const secondaryConfigured = await secondaryConfiguredFor(
      groupe.sourceClasse,
    );
    result.set(
      groupe.id,
      resolveAtelierConfiguredParentIds({
        sourceClasseId: groupe.sourceClasse.id,
        sourceBranchId: groupe.sourceClasse.branchId,
        secondaryConfiguredCoursIds: secondaryConfigured,
        atelierLinks,
      }),
    );
  }

  return result;
}

export function atelierConfiguredEmptyMessage(
  reason: AtelierConfiguredEmptyReason | null | undefined,
): string {
  if (reason === "NO_SOURCE") {
    return "Définissez la classe source du groupe avant d'affecter des enseignants.";
  }
  if (reason === "NO_MATCHING_LINKS") {
    return "Liez les cours atelier aux matières secondaires de la classe / école source.";
  }
  return "Aucun cours configuré pour ce groupe.";
}
