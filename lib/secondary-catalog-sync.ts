import { prisma as Prisma } from "@/lib/prisma";
import { normalizeBulletinSubjectKey } from "@/lib/bulletin-subjects";
import {
  SECONDARY_COURSE_CATALOG,
  expandSecondaryCoursePonderations,
  resolveSecondaryCatalogEntry,
} from "@/lib/secondary-course-catalog";

export type UpsertSecondaryCatalogResult = {
  branchId: string;
  coursesCreated: number;
  coursesUpdated: number;
  coursesSkipped: number;
  ponderationsCreated: number;
  ponderationsUpdated: number;
  ponderationsSkipped: number;
};

/**
 * Upsert les cours du catalogue secondaire RDC pour une branche.
 * - Crée / met à jour les cours (sans toucher aux sections / options)
 * - Crée / met à jour les pondérations par option existante en base
 */
export async function upsertSecondaryCatalogCoursesForBranch(
  branchId: string,
): Promise<UpsertSecondaryCatalogResult> {
  const [existingCourses, branchOptions, existingPonderations] = await Promise.all([
    Prisma.cours.findMany({
      where: { branchId },
      select: {
        id: true,
        nameCours: true,
        codeCours: true,
        description: true,
        statusCours: true,
      },
    }),
    Prisma.option.findMany({
      where: { branchId, statusOption: { not: false } },
      select: { id: true, codeOption: true },
    }),
    Prisma.coursOptionPonderation.findMany({
      where: { branchId },
      select: { id: true, coursId: true, optionId: true, ponderation: true },
    }),
  ]);

  const optionIdByCode = new Map(
    branchOptions.map((o) => [o.codeOption, o.id]),
  );
  const ponderationByPair = new Map(
    existingPonderations.map((p) => [`${p.coursId}:${p.optionId}`, p]),
  );

  const byNormalizedName = new Map(
    existingCourses.map((c) => [normalizeBulletinSubjectKey(c.nameCours), c]),
  );
  const byCode = new Map(existingCourses.map((c) => [c.codeCours, c]));

  let coursesCreated = 0;
  let coursesUpdated = 0;
  let coursesSkipped = 0;
  let ponderationsCreated = 0;
  let ponderationsUpdated = 0;
  let ponderationsSkipped = 0;

  for (const entry of SECONDARY_COURSE_CATALOG) {
    const normalized = normalizeBulletinSubjectKey(entry.nameCours);
    const aliasMatch = entry.aliases
      ?.map((a) => normalizeBulletinSubjectKey(a))
      .map((key) => byNormalizedName.get(key))
      .find(Boolean);

    const found =
      byCode.get(entry.codeCours) ??
      byNormalizedName.get(normalized) ??
      aliasMatch;

    let coursId: string;

    if (found) {
      coursId = found.id;
      const needsUpdate =
        found.description !== entry.description ||
        found.statusCours === false;

      if (needsUpdate) {
        await Prisma.cours.update({
          where: { id: found.id },
          data: {
            description: entry.description,
            statusCours: true,
          },
        });
        coursesUpdated += 1;
      } else {
        coursesSkipped += 1;
      }
    } else {
      const created = await Prisma.cours.create({
        data: {
          branchId,
          codeCours: entry.codeCours,
          nameCours: entry.nameCours,
          description: entry.description,
          statusCours: true,
        },
        select: { id: true, nameCours: true, codeCours: true },
      });
      coursId = created.id;
      byCode.set(entry.codeCours, {
        ...created,
        description: entry.description,
        statusCours: true,
      });
      byNormalizedName.set(normalized, {
        ...created,
        description: entry.description,
        statusCours: true,
      });
      coursesCreated += 1;
    }

    const ponderations = expandSecondaryCoursePonderations(entry);

    for (const [optionCode, ponderation] of ponderations) {
      const optionId = optionIdByCode.get(optionCode);
      if (!optionId) continue;

      const pairKey = `${coursId}:${optionId}`;
      const existingPonderation = ponderationByPair.get(pairKey);

      if (existingPonderation) {
        if (existingPonderation.ponderation !== ponderation) {
          await Prisma.coursOptionPonderation.update({
            where: { id: existingPonderation.id },
            data: { ponderation },
          });
          existingPonderation.ponderation = ponderation;
          ponderationsUpdated += 1;
        } else {
          ponderationsSkipped += 1;
        }
      } else {
        const created = await Prisma.coursOptionPonderation.create({
          data: {
            branchId,
            coursId,
            optionId,
            ponderation,
          },
          select: { id: true, coursId: true, optionId: true, ponderation: true },
        });
        ponderationByPair.set(pairKey, created);
        ponderationsCreated += 1;
      }
    }
  }

  return {
    branchId,
    coursesCreated,
    coursesUpdated,
    coursesSkipped,
    ponderationsCreated,
    ponderationsUpdated,
    ponderationsSkipped,
  };
}

/** Upsert catalogue pour toutes les branches SECONDAIRE actives. */
export async function upsertSecondaryCatalogCoursesForAllSecondaryBranches() {
  const branches = await Prisma.branch.findMany({
    where: { typebranch: "SECONDAIRE", isActive: true },
    select: { id: true, name: true, code: true },
  });

  const results: Array<
    UpsertSecondaryCatalogResult & { name: string; code: string | null }
  > = [];

  for (const branch of branches) {
    const result = await upsertSecondaryCatalogCoursesForBranch(branch.id);
    results.push({ ...result, name: branch.name, code: branch.code });
  }

  return results;
}

/** Recherche catalogue pour suggestion à la création manuelle d'un cours. */
export function getCatalogSecondaryPlacement(courseName: string) {
  const entry = resolveSecondaryCatalogEntry(courseName);
  if (!entry) return null;
  return {
    codeCours: entry.codeCours,
    description: entry.description,
    sortOrder: entry.sortOrder,
  };
}
