import { prisma } from "@/lib/prisma";
import { resolveCreneauClockHours } from "@/lib/attendance-exit";
import { parseHmToMinutes } from "@/lib/schedule-auto-generate";
import {
  minutesToUtcWallClock,
  nowLocal,
  resolveCheckInStatus,
  startOfTodayInTimezone,
  toMinutes,
} from "@/lib/timezone";

/**
 * Jour civil (fuseau app) couvert par un événement calendrier
 * marqué « établissement fermé / jour férié ».
 */
export async function isBranchClosedOn(
  branchId: string,
  date: Date = nowLocal(),
): Promise<boolean> {
  const dayStart = startOfTodayInTimezone(date);
  const nextDay = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const closed = await prisma.calendarEvent.findFirst({
    where: {
      branchId,
      isArchived: false,
      closesAttendance: true,
      dateStart: { lt: nextDay },
      OR: [
        { dateEnd: { gte: dayStart } },
        {
          AND: [{ dateEnd: null }, { dateStart: { gte: dayStart } }],
        },
      ],
    },
    select: { id: true },
  });

  return Boolean(closed);
}

/** Jours civils (YYYY-MM-DD, fuseau app) où l'établissement est fermé. */
export async function listBranchClosedDayKeys(
  branchId: string,
  start: Date,
  end: Date,
): Promise<Set<string>> {
  const events = await prisma.calendarEvent.findMany({
    where: {
      branchId,
      isArchived: false,
      closesAttendance: true,
      dateStart: { lt: end },
      OR: [
        { dateEnd: { gte: start } },
        { AND: [{ dateEnd: null }, { dateStart: { gte: start } }] },
      ],
    },
    select: { dateStart: true, dateEnd: true },
  });
  const keys = new Set<string>();
  for (const event of events) {
    const from = startOfTodayInTimezone(event.dateStart);
    const to = event.dateEnd ? startOfTodayInTimezone(event.dateEnd) : from;
    for (let time = from.getTime(); time <= to.getTime(); time += 86_400_000) {
      const day = new Date(time);
      if (day >= start && day < end) {
        keys.add(day.toISOString().slice(0, 10));
      }
    }
  }
  return keys;
}

async function listActiveBranchCreneaux(branchId: string) {
  return prisma.creneau.findMany({
    where: { branchId, isArchived: false },
    select: { startTime: true, endTime: true },
  });
}

/** Fenêtre de pointage du jour (samedi inclus : horaires décalés). */
export async function getBranchPointageWindowMinutes(
  branchId: string,
  now: Date = nowLocal(),
): Promise<{ startMinutes: number; endMinutes: number }> {
  const creneaux = await listActiveBranchCreneaux(branchId);
  if (creneaux.length === 0) {
    return { startMinutes: 8 * 60, endMinutes: 16 * 60 };
  }
  const windows = creneaux.map((row) => {
    const resolved = resolveCreneauClockHours(row, now);
    return {
      startMinutes: parseHmToMinutes(resolved.startTime),
      endMinutes: parseHmToMinutes(resolved.endTime),
    };
  });
  return {
    startMinutes: Math.min(...windows.map((row) => row.startMinutes)),
    endMinutes: Math.max(...windows.map((row) => row.endMinutes)),
  };
}

/** Début d'horaire le plus tôt parmi les créneaux actifs (minutes depuis minuit). */
export async function getBranchEarliestStartMinutes(
  branchId: string,
  now: Date = nowLocal(),
): Promise<number> {
  const { startMinutes } = await getBranchPointageWindowMinutes(branchId, now);
  return startMinutes;
}

/** Fin d'horaire la plus tardive parmi les créneaux actifs (minutes depuis minuit). */
export async function getBranchLatestEndMinutes(
  branchId: string,
  now: Date = nowLocal(),
): Promise<number> {
  const { endMinutes } = await getBranchPointageWindowMinutes(branchId, now);
  return endMinutes;
}

export function minutesToLocalDate(minutes: number, day = nowLocal()): Date {
  const result = new Date(day);
  result.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return result;
}

export async function getBranchDayEndDate(
  branchId: string,
  now = nowLocal(),
): Promise<Date> {
  const endMinutes = await getBranchLatestEndMinutes(branchId, now);
  return minutesToLocalDate(endMinutes, now);
}

/** Sortie normale personnel = à l'heure de fin du créneau (pas avant). */
export async function isPersonnelNormalCheckoutAllowed(
  branchId: string,
  now = nowLocal(),
): Promise<boolean> {
  const endMinutes = await getBranchLatestEndMinutes(branchId, now);
  return toMinutes(now) >= endMinutes;
}

/** Présent si arrivée ≤ heure de début du créneau ; retard après. */
export async function resolvePersonnelStatusFromSchedule(
  branchId: string,
  now: Date = nowLocal(),
): Promise<"PRESENT" | "LATE"> {
  const startMinutes = await getBranchEarliestStartMinutes(branchId, now);
  return resolveCheckInStatus(minutesToUtcWallClock(startMinutes), now);
}
