import { prisma as Prisma } from "@/lib/prisma";
import { normalizeBulletinSubjectKey } from "@/lib/bulletin-subjects";
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
};

/**
 * Upsert tous les cours du catalogue primaire RDC pour une branche.
 * - Crée les cours absents (par nom normalisé ou code catalogue)
 * - Met à jour domaine / section / ordre sur les cours existants correspondants
 */
export async function upsertPrimaryCatalogCoursesForBranch(
  branchId: string,
): Promise<UpsertPrimaryCatalogResult> {
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

  let created = 0;
  let updated = 0;
  let skipped = 0;

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

    const found =
      byNormalizedName.get(normalized) ??
      aliasMatch ??
      byCode.get(codeCours);

    if (found) {
      const needsUpdate =
        found.primaryDomain !== entry.domain ||
        found.primarySection !== section ||
        found.domainOrder !== entry.sortOrder;

      if (needsUpdate) {
        await Prisma.cours.update({
          where: { id: found.id },
          data: {
            primaryDomain: entry.domain,
            primarySection: section,
            domainOrder: entry.sortOrder,
            statusCours: true,
          },
        });
        updated += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    await Prisma.cours.create({
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
    });
    created += 1;
  }

  return { branchId, created, updated, skipped };
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
