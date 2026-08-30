import { prisma as Prisma } from "@/lib/prisma";
import { normalizeBulletinSubjectKey } from "@/lib/bulletin-subjects";
import {
  ANGOLA_SECONDARY_COURSE_CATALOG,
  matchAngolaSecondaryCourse,
} from "@/lib/angola-secondary-course-catalog";

export type UpsertAngolaCoursesResult = {
  branchId: string;
  coursesCreated: number;
  coursesUpdated: number;
  coursesSkipped: number;
  ponderationsCreated: number;
  ponderationsUpdated: number;
  ponderationsSkipped: number;
};

/**
 * Crée les disciplinas PORTUGUESA (7ª–13ª) si elles n'existent pas encore,
 * puis les pondère sur toutes les options actives de la branche.
 */
export async function upsertAngolaSecondaryCoursesForBranch(
  branchId: string,
): Promise<UpsertAngolaCoursesResult> {
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
      select: { id: true },
    }),
    Prisma.coursOptionPonderation.findMany({
      where: { branchId },
      select: {
        id: true,
        coursId: true,
        optionId: true,
        ponderation: true,
        level: true,
      },
    }),
  ]);

  const ponderationByPair = new Map(
    existingPonderations
      .filter((row) => !row.level)
      .map((row) => [`${row.coursId}:${row.optionId}`, row]),
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

  for (const entry of ANGOLA_SECONDARY_COURSE_CATALOG) {
    const normalized = normalizeBulletinSubjectKey(entry.nameCours);
    const aliasMatch = existingCourses.find((row) => {
      const match = matchAngolaSecondaryCourse(row.nameCours);
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
        found.description !== entry.description || found.statusCours === false;
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
          sortOrder: entry.sortOrder,
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

    for (const option of branchOptions) {
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
            level: true,
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

export async function upsertAngolaSecondaryCoursesForAllAngolaBranches() {
  const branches = await Prisma.branch.findMany({
    where: {
      educationSystem: "ANGOLAIS",
      isActive: true,
      OR: [
        { typebranch: "SECONDAIRE" },
        { cycles: { some: { cycle: "SECONDAIRE", isActive: true } } },
      ],
    },
    select: { id: true, name: true, code: true },
  });

  const results = [];
  for (const branch of branches) {
    const result = await upsertAngolaSecondaryCoursesForBranch(branch.id);
    results.push({ ...result, name: branch.name, code: branch.code });
  }
  return results;
}
