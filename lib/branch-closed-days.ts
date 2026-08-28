import { prisma } from "@/lib/prisma";
import {
  nowLocal,
  scheduleHourToMinutes,
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

/** Début d'horaire le plus tôt parmi les créneaux actifs (minutes depuis minuit). */
export async function getBranchEarliestStartMinutes(
  branchId: string,
): Promise<number> {
  const creneaux = await prisma.creneau.findMany({
    where: { branchId, isArchived: false },
    select: { startTime: true },
  });
  if (creneaux.length === 0) return 8 * 60;
  return Math.min(
    ...creneaux.map((row) => scheduleHourToMinutes(row.startTime)),
  );
}

/** Présent / retard personnel selon le début du créneau (+10 min de tolérance). */
export async function resolvePersonnelStatusFromSchedule(
  branchId: string,
  now: Date = nowLocal(),
): Promise<"PRESENT" | "LATE"> {
  const startMinutes = await getBranchEarliestStartMinutes(branchId);
  return toMinutes(now) > startMinutes + 10 ? "LATE" : "PRESENT";
}
