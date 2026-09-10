import { prisma } from "@/lib/prisma";
import type { Day } from "@/prisma/generated/prisma/client";
import {
  ATTENDANCE_WEEKEND_DAYS,
  DEFAULT_CRENEAU_WORKING_DAYS,
  PRIMARY_CRENEAU_WORKING_DAYS,
  normalizeCreneauWorkingDays,
  unionCreneauWorkingDays,
} from "@/lib/creneau-working-days";
import { getAppWeekday } from "@/lib/timezone";

const WEEKDAY_INDEX_TO_DAY: Record<number, Day> = {
  0: "Dimanche",
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
  6: "Samedi",
};

export function weekendClosedForCycle(cycleOrType: unknown): boolean {
  return cycleOrType === "PRIMAIRE" || cycleOrType === "MATERNELLE";
}

export function calendarDayName(date: Date): Day {
  return WEEKDAY_INDEX_TO_DAY[getAppWeekday(date)] ?? "Dimanche";
}

export function isAttendanceSchoolDay(params: {
  date: Date;
  workingDays: readonly string[];
  closedDayKeys?: Set<string>;
  dayIso?: string;
  weekendClosed?: boolean;
}): boolean {
  const dayName = calendarDayName(params.date);
  if (params.weekendClosed && ATTENDANCE_WEEKEND_DAYS.has(dayName)) {
    return false;
  }
  const workingDays = normalizeCreneauWorkingDays([...params.workingDays]);
  if (!workingDays.includes(dayName)) {
    return false;
  }
  const iso =
    params.dayIso ??
    new Date(
      Date.UTC(
        params.date.getUTCFullYear(),
        params.date.getUTCMonth(),
        params.date.getUTCDate(),
      ),
    )
      .toISOString()
      .slice(0, 10);
  if (params.closedDayKeys?.has(iso)) {
    return false;
  }
  return true;
}

export function countAttendanceSchoolDaysInMonth(params: {
  year: number;
  month: number;
  workingDays: readonly string[];
  closedDayKeys?: Set<string>;
  weekendClosed?: boolean;
  untilIso?: string | null;
}): number {
  const dim = new Date(Date.UTC(params.year, params.month, 0)).getUTCDate();
  let open = 0;
  for (let day = 1; day <= dim; day += 1) {
    const date = new Date(Date.UTC(params.year, params.month - 1, day));
    const iso = date.toISOString().slice(0, 10);
    if (params.untilIso && iso > params.untilIso) continue;
    if (
      isAttendanceSchoolDay({
        date,
        workingDays: params.workingDays,
        closedDayKeys: params.closedDayKeys,
        dayIso: iso,
        weekendClosed: params.weekendClosed,
      })
    ) {
      open += 1;
    }
  }
  return open;
}

export async function resolveAttendanceSchoolCalendar(params: {
  branchId: string;
  classeId?: string | null;
}): Promise<{
  workingDays: Day[];
  weekendClosed: boolean;
}> {
  const [branch, classe, creneaux] = await Promise.all([
    prisma.branch.findFirst({
      where: { id: params.branchId },
      select: { typebranch: true },
    }),
    params.classeId
      ? prisma.classe.findFirst({
          where: { id: params.classeId, branchId: params.branchId },
          select: {
            cycle: true,
            creneauId: true,
            creneau: { select: { workingDays: true, isArchived: true } },
          },
        })
      : Promise.resolve(null),
    prisma.creneau.findMany({
      where: { branchId: params.branchId, isArchived: false },
      select: { workingDays: true },
    }),
  ]);

  const weekendClosed = weekendClosedForCycle(
    classe?.cycle ?? branch?.typebranch,
  );
  const fallback = weekendClosed
    ? PRIMARY_CRENEAU_WORKING_DAYS
    : DEFAULT_CRENEAU_WORKING_DAYS;

  const classCreneau =
    classe?.creneau && !classe.creneau.isArchived
      ? classe.creneau.workingDays
      : null;

  const workingDays = classCreneau
    ? normalizeCreneauWorkingDays(classCreneau)
    : unionCreneauWorkingDays(
        creneaux.map((row) => row.workingDays),
        fallback,
      );

  return { workingDays, weekendClosed };
}
