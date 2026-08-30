import { prisma as Prisma } from "@/lib/prisma";
import {
  ANGOLA_PRIMARY_COURSE_CATALOG,
  matchAngolaPrimaryCourse,
} from "@/lib/angola-primary-course-catalog";
import { ensureAngolaPrimaryStructure } from "@/lib/angola-primary-bootstrap";
import { normalizeBulletinSubjectKey } from "@/lib/bulletin-subjects";
import { PRIMARY_DOMAIN_LABELS } from "@/lib/primary-domains";

export type UpsertAngolaPrimaryCoursesResult = {
  branchId: string;
  coursesCreated: number;
  coursesUpdated: number;
  coursesSkipped: number;
  ponderationsCreated: number;
  ponderationsUpdated: number;
  ponderationsSkipped: number;
};

/**
 * Crée les disciplinas du 1.º ciclo (1ª–4ª) et les pondère
 * sur l'option unique Geral.
 */
export async function upsertAngolaPrimaryCoursesForBranch(
  branchId: string,
): Promise<UpsertAngolaPrimaryCoursesResult> {
  const { option } = await ensureAngolaPrimaryStructure(Prisma, branchId);
  const firstCycleOptions = [option];

  const [existingCourses, existingPonderations] = await Promise.all([
    Prisma.cours.findMany({
      where: { branchId },
      select: {
        id: true,
        nameCours: true,
        codeCours: true,
        description: true,
        statusCours: true,
        primaryDomain: true,
        domainOrder: true,
      },
    }),
    Prisma.coursOptionPonderation.findMany({
      where: { branchId },
      select: {
        id: true,
        coursId: true,
        optionId: true,
        ponderation: true,
      },
    }),
  ]);

  const ponderationByPair = new Map(
    existingPonderations.map((row) => [`${row.coursId}:${row.optionId}`, row]),
  );
  const byNormalizedName = new Map(
    existingCourses.map((row) => [
      normalizeBulletinSubjectKey(row.nameCours),
      row,
    ]),
  );
  const byCode = new Map(existingCourses.map((row) => [row.codeCours, row]));

  let coursesCreated = 0;
  let coursesUpdated = 0;
  let coursesSkipped = 0;
  let ponderationsCreated = 0;
  let ponderationsUpdated = 0;
  let ponderationsSkipped = 0;

  for (const entry of ANGOLA_PRIMARY_COURSE_CATALOG) {
    const normalized = normalizeBulletinSubjectKey(entry.nameCours);
    const aliasMatch = existingCourses.find((row) => {
      const match = matchAngolaPrimaryCourse(row.nameCours);
      return match?.codeCours === entry.codeCours;
    });
    const found =
      byCode.get(entry.codeCours) ??
      byNormalizedName.get(normalized) ??
      aliasMatch;

    let coursId: string;

    if (found) {
      coursId = found.id;
      const needsUpdate =
        found.description !== entry.description ||
        found.statusCours === false ||
        found.primaryDomain !== entry.primaryDomain ||
        found.domainOrder !== entry.sortOrder;
      if (needsUpdate) {
        await Prisma.cours.update({
          where: { id: found.id },
          data: {
            description: entry.description,
            statusCours: true,
            primaryDomain: entry.primaryDomain,
            primarySection: PRIMARY_DOMAIN_LABELS[entry.primaryDomain],
            domainOrder: entry.sortOrder,
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
          sortOrder: entry.sortOrder,
          primaryDomain: entry.primaryDomain,
          primarySection: PRIMARY_DOMAIN_LABELS[entry.primaryDomain],
          domainOrder: entry.sortOrder,
        },
        select: { id: true, nameCours: true, codeCours: true },
      });
      coursId = created.id;
      const stored = {
        ...created,
        description: entry.description,
        statusCours: true,
        primaryDomain: entry.primaryDomain,
        domainOrder: entry.sortOrder,
      };
      byCode.set(entry.codeCours, stored);
      byNormalizedName.set(normalized, stored);
      coursesCreated += 1;
    }

    for (const option of firstCycleOptions) {
      const pairKey = `${coursId}:${option.id}`;
      const existing = ponderationByPair.get(pairKey);
      if (existing) {
        if (existing.ponderation !== entry.ponderation) {
          await Prisma.coursOptionPonderation.update({
            where: { id: existing.id },
            data: { ponderation: entry.ponderation },
          });
          existing.ponderation = entry.ponderation;
          ponderationsUpdated += 1;
        } else {
          ponderationsSkipped += 1;
        }
      } else {
        const created = await Prisma.coursOptionPonderation.create({
          data: {
            branchId,
            coursId,
            optionId: option.id,
            ponderation: entry.ponderation,
            level: "",
          },
          select: {
            id: true,
            coursId: true,
            optionId: true,
            ponderation: true,
          },
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

export async function upsertAngolaPrimaryCoursesForAllAngolaBranches() {
  const branches = await Prisma.branch.findMany({
    where: {
      educationSystem: "ANGOLAIS",
      isActive: true,
      OR: [
        { typebranch: "PRIMAIRE" },
        { cycles: { some: { cycle: "PRIMAIRE", isActive: true } } },
      ],
    },
    select: { id: true, name: true, code: true },
  });

  const results = [];
  for (const branch of branches) {
    const result = await upsertAngolaPrimaryCoursesForBranch(branch.id);
    results.push({ ...result, name: branch.name, code: branch.code });
  }
  return results;
}
