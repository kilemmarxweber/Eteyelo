import { prisma } from "@/lib/prisma";
import {
  scheduleHourToMinutes,
  TEACHER_COURSE_DURATION_MINUTES,
} from "@/lib/timezone";
import { cycleLabel, resolveCycle } from "@/lib/cycle";
import type { Day } from "@/prisma/generated/prisma/client";

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

function intervalsOverlap(
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

/** Tous les profils Teacher du même User dans l'organisation. */
export async function listSiblingTeacherIds(params: {
  userId: string;
  organizationId: string;
}): Promise<string[]> {
  const rows = await prisma.teacher.findMany({
    where: {
      branchMember: {
        member: {
          userId: params.userId,
          organizationId: params.organizationId,
          isArchived: false,
        },
      },
    },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

export async function listTeacherBusySlots(params: {
  userId: string;
  organizationId: string;
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
  });
  if (teacherIds.length === 0) return [];

  const schedules = await prisma.schedule.findMany({
    where: {
      isArchived: false,
      ...(params.excludeScheduleIds?.length
        ? { id: { notIn: params.excludeScheduleIds } }
        : {}),
      teaching: {
        teacherId: { in: teacherIds },
        OR: [{ statusTeaching: true }, { statusTeaching: null }],
        ...(params.excludeClasseId
          ? { classeId: { not: params.excludeClasseId } }
          : {}),
        ...(params.currentYearOnly !== false
          ? {
              schoolYear: {
                isCurrentYear: true,
                isArchived: false,
              },
            }
          : {}),
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
          cours: { select: { nameCours: true } },
          branch: { select: { id: true, name: true } },
        },
      },
    },
  });

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
        courseName: row.teaching.cours?.nameCours ?? "Cours",
      },
    ];
  });
}

/**
 * Refuse si le même User a déjà une séance qui chevauche
 * (toutes branches / cycles de l'organisation).
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
  if (!userId) return;

  const duration = params.durationMinutes ?? TEACHER_COURSE_DURATION_MINUTES;
  const endMin = params.startMin + duration;
  const busy = await listTeacherBusySlots({
    userId,
    organizationId: params.organizationId,
    excludeScheduleIds: params.excludeScheduleId
      ? [params.excludeScheduleId]
      : undefined,
  });

  const conflict = busy.find((slot) => {
    if (slot.day !== params.day) return false;
    return intervalsOverlap(params.startMin, endMin, slot.startMin, slot.endMin);
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
