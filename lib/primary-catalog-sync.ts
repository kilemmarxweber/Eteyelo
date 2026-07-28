import { prisma as Prisma } from "@/lib/prisma";
import { BULLETIN_PONDERATION_FACTOR } from "@/lib/bulletin-maxima";
import { normalizeBulletinSubjectKey } from "@/lib/bulletin-subjects";
import { ensurePrimaryAcademicStructure } from "@/lib/primary-academic-structure";
import {
  PRIMARY_COURSE_CATALOG,
  PRIMARY_DOMAIN_LABELS,
  buildPrimaryCatalogCourseCode,
  getPrimaryCatalogSection,
} from "@/lib/primary-domains";

export type UpsertPrimaryCatalogResult = {
  branchId: string;
  created: number;
  updated: number;
  skipped: number;
  ponderationsCreated: number;
  ponderationsUpdated: number;
  ponderationsSkipped: number;
};

/** max période RDC → pondération (ex. 10 → 1, 5 → 0.5). */
export function primaryMaxPerToPonderation(maxPer: number): number {
  return maxPer / BULLETIN_PONDERATION_FACTOR;
}

/**
 * Upsert tous les cours du catalogue primaire RDC pour une branche.
 * - Crée les cours absents (par nom normalisé ou code catalogue)
 * - Met à jour domaine / section / ordre sur les cours existants correspondants
 * - Configure les pondérations pour chaque niveau (1è–6è) : maxPer / 10
 */
export async function upsertPrimaryCatalogCoursesForBranch(
  branchId: string,
): Promise<UpsertPrimaryCatalogResult> {
  const { options } = await ensurePrimaryAcademicStructure(Prisma, branchId);

  const existing = await Prisma.cours.findMany({
    where: { branchId },
    select: {
      id: true,
      nameCours: true,
      codeCours: true,
      primaryDomain: true,
      primarySection: true,
      domainOrder: true,
    },
  });

  const byNormalizedName = new Map(
    existing.map((c) => [normalizeBulletinSubjectKey(c.nameCours), c]),
  );
  const byCode = new Map(existing.map((c) => [c.codeCours, c]));

  const existingPonderations = await Prisma.coursOptionPonderation.findMany({
    where: { branchId, optionId: { in: options.map((o) => o.id) } },
    select: { id: true, coursId: true, optionId: true, ponderation: true },
  });
  const ponderationByPair = new Map(
    existingPonderations.map((row) => [
      `${row.coursId}:${row.optionId}`,
      row,
    ]),
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let ponderationsCreated = 0;
  let ponderationsUpdated = 0;
  let ponderationsSkipped = 0;

  for (const entry of PRIMARY_COURSE_CATALOG) {
    const codeCours = buildPrimaryCatalogCourseCode(entry);
    const section = getPrimaryCatalogSection(entry);
    const description = `${PRIMARY_DOMAIN_LABELS[entry.domain]}${
      section ? ` — ${section}` : ""
    }`;

    const normalized = normalizeBulletinSubjectKey(entry.name);
    const aliasMatch = entry.aliases
      ?.map((a) => normalizeBulletinSubjectKey(a))
      .map((key) => byNormalizedName.get(key))
      .find(Boolean);

    let course =
      byNormalizedName.get(normalized) ??
      aliasMatch ??
      byCode.get(codeCours) ??
      null;

    if (course) {
      const needsUpdate =
        course.primaryDomain !== entry.domain ||
        course.primarySection !== section ||
        course.domainOrder !== entry.sortOrder;

      if (needsUpdate) {
        course = await Prisma.cours.update({
          where: { id: course.id },
          data: {
            primaryDomain: entry.domain,
            primarySection: section,
            domainOrder: entry.sortOrder,
            statusCours: true,
          },
          select: {
            id: true,
            nameCours: true,
            codeCours: true,
            primaryDomain: true,
            primarySection: true,
            domainOrder: true,
          },
        });
        updated += 1;
      } else {
        skipped += 1;
      }
    } else {
      course = await Prisma.cours.create({
        data: {
          branchId,
          nameCours: entry.name,
          codeCours,
          description,
          statusCours: true,
          primaryDomain: entry.domain,
          primarySection: section,
          domainOrder: entry.sortOrder,
        },
        select: {
          id: true,
          nameCours: true,
          codeCours: true,
          primaryDomain: true,
          primarySection: true,
          domainOrder: true,
        },
      });
      created += 1;
      byNormalizedName.set(normalized, course);
      byCode.set(codeCours, course);
    }

    if (entry.maxPer != null && entry.maxPer > 0 && course) {
      const ponderation = primaryMaxPerToPonderation(entry.maxPer);

      for (const levelOption of options) {
        const pairKey = `${course.id}:${levelOption.id}`;
        const existingWeight = ponderationByPair.get(pairKey);

        if (!existingWeight) {
          const createdWeight = await Prisma.coursOptionPonderation.create({
            data: {
              branchId,
              coursId: course.id,
              optionId: levelOption.id,
              ponderation,
            },
            select: {
              id: true,
              coursId: true,
              optionId: true,
              ponderation: true,
            },
          });
          ponderationByPair.set(pairKey, createdWeight);
          ponderationsCreated += 1;
        } else if (Math.abs(existingWeight.ponderation - ponderation) > 1e-9) {
          const updatedWeight = await Prisma.coursOptionPonderation.update({
            where: { id: existingWeight.id },
            data: { ponderation },
            select: {
              id: true,
              coursId: true,
              optionId: true,
              ponderation: true,
            },
          });
          ponderationByPair.set(pairKey, updatedWeight);
          ponderationsUpdated += 1;
        } else {
          ponderationsSkipped += 1;
        }
      }
    }
  }

  return {
    branchId,
    created,
    updated,
    skipped,
    ponderationsCreated,
    ponderationsUpdated,
    ponderationsSkipped,
  };
}

/** Upsert catalogue pour toutes les branches PRIMAIRE. */
export async function upsertPrimaryCatalogCoursesForAllPrimaryBranches() {
  const branches = await Prisma.branch.findMany({
    where: { typebranch: "PRIMAIRE", isActive: true },
    select: { id: true, name: true, code: true },
  });

  const results: Array<
    UpsertPrimaryCatalogResult & { name: string; code: string | null }
  > = [];

  for (const branch of branches) {
    const result = await upsertPrimaryCatalogCoursesForBranch(branch.id);
    results.push({ ...result, name: branch.name, code: branch.code });
  }

  return results;
}
