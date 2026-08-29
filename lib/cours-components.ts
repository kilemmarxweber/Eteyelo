import type { CoursKind, Prisma } from "@/prisma/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { activeCoursStatusFilter } from "@/lib/active-cours";

export type { CoursKind };

export const COURS_KIND = {
  SUBJECT: "SUBJECT",
  SCHEDULE_COMPONENT: "SCHEDULE_COMPONENT",
} as const satisfies Record<string, CoursKind>;

/** Cours bulletin / notes (parents only). */
export const gradeableCoursFilter: Prisma.CoursWhereInput = {
  kind: COURS_KIND.SUBJECT,
  parentCoursId: null,
};

/** Postes d'horaire uniquement. */
export const scheduleComponentCoursFilter: Prisma.CoursWhereInput = {
  kind: COURS_KIND.SCHEDULE_COMPONENT,
};

export function isGradeableCours(cours: {
  kind?: string | null;
  parentCoursId?: string | null;
}): boolean {
  if (cours.parentCoursId) return false;
  return (cours.kind ?? COURS_KIND.SUBJECT) === COURS_KIND.SUBJECT;
}

export function isScheduleComponentCours(cours: {
  kind?: string | null;
  parentCoursId?: string | null;
}): boolean {
  return (
    cours.kind === COURS_KIND.SCHEDULE_COMPONENT || Boolean(cours.parentCoursId)
  );
}

/** Libellé horaire : poste, avec rappel du parent si fourni. */
export function formatScheduleCoursLabel(params: {
  nameCours: string;
  parentNameCours?: string | null;
  kind?: string | null;
  parentCoursId?: string | null;
}): string {
  if (
    isScheduleComponentCours(params) &&
    params.parentNameCours &&
    params.parentNameCours !== params.nameCours
  ) {
    return `${params.nameCours} (${params.parentNameCours})`;
  }
  return params.nameCours;
}

/**
 * À partir des IDs pondérés (parents SUBJECT), retourne les IDs à affecter /
 * placer à l'horaire : composants actifs s'il y en a, sinon le parent.
 */
export async function expandConfiguredCoursIdsForSchedule(params: {
  branchId: string;
  configuredParentIds: string[];
}): Promise<string[]> {
  const parentIds = [...new Set(params.configuredParentIds.filter(Boolean))];
  if (!parentIds.length) return [];

  const components = await prisma.cours.findMany({
    where: {
      branchId: params.branchId,
      parentCoursId: { in: parentIds },
      kind: COURS_KIND.SCHEDULE_COMPONENT,
      ...activeCoursStatusFilter,
    },
    select: { id: true, parentCoursId: true },
    orderBy: [{ sortOrder: "asc" }, { nameCours: "asc" }],
  });

  const byParent = new Map<string, string[]>();
  for (const row of components) {
    if (!row.parentCoursId) continue;
    const list = byParent.get(row.parentCoursId) ?? [];
    list.push(row.id);
    byParent.set(row.parentCoursId, list);
  }

  const result: string[] = [];
  for (const parentId of parentIds) {
    const kids = byParent.get(parentId);
    if (kids?.length) {
      result.push(...kids);
    } else {
      result.push(parentId);
    }
  }
  return result;
}

/**
 * Propage teacherId à tous les Teachings du groupe parent + postes
 * (classe × année). Un seul enseignant pour le cours parent.
 */
export async function syncTeacherForParentComponentGroup(params: {
  branchId: string;
  coursId: string;
  classeId: string;
  schoolYearId: string;
  teacherId: string;
}): Promise<void> {
  const cours = await prisma.cours.findFirst({
    where: { id: params.coursId, branchId: params.branchId },
    select: { id: true, kind: true, parentCoursId: true },
  });
  if (!cours) return;

  const parentId =
    cours.kind === COURS_KIND.SCHEDULE_COMPONENT && cours.parentCoursId
      ? cours.parentCoursId
      : cours.kind === COURS_KIND.SUBJECT
        ? cours.id
        : null;
  if (!parentId) return;

  const siblings = await prisma.cours.findMany({
    where: {
      branchId: params.branchId,
      OR: [
        { id: parentId },
        {
          parentCoursId: parentId,
          kind: COURS_KIND.SCHEDULE_COMPONENT,
        },
      ],
    },
    select: { id: true },
  });
  const siblingIds = siblings.map((row) => row.id);
  if (siblingIds.length <= 1) return;

  await prisma.teaching.updateMany({
    where: {
      classeId: params.classeId,
      schoolYearId: params.schoolYearId,
      coursId: { in: siblingIds },
      OR: [{ statusTeaching: true }, { statusTeaching: null }],
      NOT: { teacherId: params.teacherId },
    },
    data: { teacherId: params.teacherId },
  });
}

export function slugifyComponentCodePart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 8);
}
