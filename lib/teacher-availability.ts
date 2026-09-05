import { prisma } from "@/lib/prisma";
import {
  scheduleHourToMinutes,
  TEACHER_COURSE_DURATION_MINUTES,
} from "@/lib/timezone";
import { cycleLabel, resolveCycle } from "@/lib/cycle";
import type { Day } from "@/prisma/generated/prisma/client";
import {
  formatScheduleCoursLabel,
  subjectIdsReplacedBySchedulePosts,
} from "@/lib/cours-components";

export type TeacherBusySlot = {
  scheduleId: string;
  branchId: string;
  branchName: string;
  cycleLabel?: string;
  day: Day;
  startMin: number;
  endMin: number;
  className: string;
  courseName: string;
};

export function teacherBusyIntervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
) {
  return aStart < bEnd && bStart < aEnd;
}

export async function getTeacherUserId(
  teacherId: string,
): Promise<string | null> {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    select: {
      branchMember: {
        select: { member: { select: { userId: true } } },
      },
    },
  });
  return teacher?.branchMember?.member?.userId ?? null;
}

/**
 * Tous les profils Teacher du même User dans l'organisation
 * (une fiche Teacher par branche). Les horaires restants comptent
 * même si le membre est archivé ou inactif dans une branche.
 */
export async function listSiblingTeacherIds(params: {
  userId?: string | null;
  organizationId: string;
  extraTeacherIds?: string[];
}): Promise<string[]> {
  const ids = new Set(
    (params.extraTeacherIds ?? []).filter((id) => id.length > 0),
  );
  if (params.userId) {
    const rows = await prisma.teacher.findMany({
      where: {
        branchMember: {
          member: {
            userId: params.userId,
            organizationId: params.organizationId,
          },
          branch: { organizationId: params.organizationId },
        },
      },
      select: { id: true },
    });
    for (const row of rows) ids.add(row.id);
  }
  return [...ids];
}

export async function listTeacherBusySlots(params: {
  organizationId: string;
  /** Identité User — relie les fiches Teacher des autres branches. */
  userId?: string | null;
  /** Toujours inclus, même sans User lié. */
  teacherId?: string | null;
  /** Si fourni, limite aux années courantes des branches. */
  currentYearOnly?: boolean;
  /** Exclure les séances d'une classe (ex. celle en cours de régénération). */
  excludeClasseId?: string;
  /** Exclure des schedule ids précis. */
  excludeScheduleIds?: string[];
}): Promise<TeacherBusySlot[]> {
  const teacherIds = await listSiblingTeacherIds({
    userId: params.userId,
    organizationId: params.organizationId,
    extraTeacherIds: params.teacherId ? [params.teacherId] : [],
  });
  if (teacherIds.length === 0) return [];

  const schedules = await prisma.schedule.findMany({
    where: {
      isArchived: false,
      ...(params.excludeScheduleIds?.length
        ? { id: { notIn: params.excludeScheduleIds } }
        : {}),
      teaching: {
        AND: [
          { teacherId: { in: teacherIds } },
          { OR: [{ statusTeaching: true }, { statusTeaching: null }] },
          {
            OR: [
              { branch: { organizationId: params.organizationId } },
              { classe: { branch: { organizationId: params.organizationId } } },
              {
                schoolYear: {
                  branch: { organizationId: params.organizationId },
                },
              },
            ],
          },
          ...(params.excludeClasseId
            ? [{ classeId: { not: params.excludeClasseId } }]
            : []),
          ...(params.currentYearOnly !== false
            ? [
                {
                  schoolYear: {
                    isCurrentYear: true,
                    isArchived: false,
                  },
                },
              ]
            : []),
        ],
      },
    },
    select: {
      id: true,
      day: true,
      hour: true,
      teaching: {
        select: {
          branchId: true,
          classe: {
            select: {
              nameClasse: true,
              branchId: true,
              cycle: true,
              branch: {
                select: { id: true, name: true, typebranch: true },
              },
              creneau: { select: { durationCourse: true } },
            },
          },
          cours: {
            select: {
              id: true,
              nameCours: true,
              kind: true,
              parentCoursId: true,
              parentCours: { select: { nameCours: true } },
            },
          },
          branch: { select: { id: true, name: true } },
        },
      },
    },
  });

  const subjectIdsByBranch = new Map<string, string[]>();
  for (const row of schedules) {
    const branchId =
      row.teaching?.branchId ??
      row.teaching?.classe?.branchId ??
      row.teaching?.classe?.branch?.id ??
      row.teaching?.branch?.id ??
      "";
    const subjectId =
      row.teaching?.cours?.parentCoursId ?? row.teaching?.cours?.id;
    if (!branchId || !subjectId) continue;
    const list = subjectIdsByBranch.get(branchId) ?? [];
    list.push(subjectId);
    subjectIdsByBranch.set(branchId, list);
  }

  const replacedByBranch = new Map<string, Set<string>>();
  await Promise.all(
    [...subjectIdsByBranch.entries()].map(async ([branchId, subjectIds]) => {
      replacedByBranch.set(
        branchId,
        await subjectIdsReplacedBySchedulePosts({ branchId, subjectIds }),
      );
    }),
  );

  return schedules.flatMap((row) => {
    if (!row.hour || !row.teaching) return [];
    const startMin = scheduleHourToMinutes(row.hour);
    const duration =
      row.teaching.classe?.creneau?.durationCourse ??
      TEACHER_COURSE_DURATION_MINUTES;
    const branchId =
      row.teaching.branchId ??
      row.teaching.classe?.branchId ??
      row.teaching.classe?.branch?.id ??
      row.teaching.branch?.id ??
      "";
    if (replacedByBranch.get(branchId)?.has(row.teaching.cours?.id ?? "")) {
      return [];
    }
    const branchName =
      row.teaching.branch?.name ??
      row.teaching.classe?.branch?.name ??
      "Établissement";
    const cycle = resolveCycle(
      row.teaching.classe,
      row.teaching.classe?.branch,
    );
    return [
      {
        scheduleId: row.id,
        branchId,
        branchName,
        cycleLabel: cycleLabel(cycle),
        day: row.day,
        startMin,
        endMin: startMin + duration,
        className: row.teaching.classe?.nameClasse ?? "Classe",
        courseName: formatScheduleCoursLabel({
          nameCours: row.teaching.cours?.nameCours ?? "Cours",
          parentNameCours: row.teaching.cours?.parentCours?.nameCours,
          kind: row.teaching.cours?.kind,
          parentCoursId: row.teaching.cours?.parentCoursId,
        }),
      },
    ];
  });
}

/**
 * Refuse si la même personne a déjà une séance qui chevauche
 * (toutes les branches / cycles de l'organisation).
 */
export async function assertTeacherFreeAt(params: {
  teacherId: string;
  organizationId: string;
  day: Day;
  startMin: number;
  durationMinutes?: number;
  excludeScheduleId?: string;
}): Promise<void> {
  const userId = await getTeacherUserId(params.teacherId);
  const duration = params.durationMinutes ?? TEACHER_COURSE_DURATION_MINUTES;
  const endMin = params.startMin + duration;
  const busy = await listTeacherBusySlots({
    userId,
    teacherId: params.teacherId,
    organizationId: params.organizationId,
    excludeScheduleIds: params.excludeScheduleId
      ? [params.excludeScheduleId]
      : undefined,
  });

  const conflict = busy.find((slot) => {
    if (slot.day !== params.day) return false;
    return teacherBusyIntervalsOverlap(
      params.startMin,
      endMin,
      slot.startMin,
      slot.endMin,
    );
  });

  if (!conflict) return;

  const hourLabel = `${String(Math.floor(conflict.startMin / 60)).padStart(2, "0")}:${String(conflict.startMin % 60).padStart(2, "0")}`;
  const where = [conflict.className, conflict.cycleLabel, conflict.branchName]
    .filter(Boolean)
    .join(" · ");
  throw new Error(
    `Conflit d'horaire : l'enseignant a déjà ${conflict.courseName} (${where}) le ${conflict.day} à ${hourLabel}. Un enseignant ne peut pas être à deux endroits à la même heure.`,
  );
}
