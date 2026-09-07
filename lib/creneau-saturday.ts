import {
  formatMinutesToHm,
  generateCourseStartSlots,
  parseHmToMinutes,
} from "@/lib/schedule-auto-generate";

/** Fenêtre du samedi : les vacations d'après-midi y passent le matin. */
export const SATURDAY_SESSION_START = "07:30";
export const SATURDAY_SESSION_END = "12:30";

const NOON_MINUTES = 12 * 60;
const SATURDAY_END_LIMIT_MINUTES = parseHmToMinutes(SATURDAY_SESSION_END);

export type VacationClockHours = {
  startTime: string;
  endTime: string;
  recreationHour?: string | null;
  recreationDuration?: number | null;
  durationCourse: number;
};

export function isAfternoonVacation(startTime: string): boolean {
  return parseHmToMinutes(startTime) >= NOON_MINUTES;
}

export function saturdayUsesShiftedMorningHours(startTime: string): boolean {
  return isAfternoonVacation(startTime);
}

/** Heures réellement utilisées un jour donné (samedi après-midi → 7h30–12h30). */
export function resolveVacationHoursForDay(
  hours: VacationClockHours,
  day: string,
): VacationClockHours {
  if (day !== "Samedi") return hours;

  if (!isAfternoonVacation(hours.startTime)) {
    const start = parseHmToMinutes(hours.startTime);
    const end = Math.min(
      parseHmToMinutes(hours.endTime),
      SATURDAY_END_LIMIT_MINUTES,
    );
    return {
      ...hours,
      endTime: formatMinutesToHm(Math.max(start, end)),
    };
  }

  const weekdayStart = parseHmToMinutes(hours.startTime);
  const weekdayEnd = parseHmToMinutes(hours.endTime);
  const satStart = parseHmToMinutes(SATURDAY_SESSION_START);
  const span = Math.max(0, weekdayEnd - weekdayStart);
  const satEnd = Math.min(SATURDAY_END_LIMIT_MINUTES, satStart + span);
  const offset = satStart - weekdayStart;
  const recre = hours.recreationHour
    ? parseHmToMinutes(hours.recreationHour) + offset
    : null;

  return {
    ...hours,
    startTime: SATURDAY_SESSION_START,
    endTime: formatMinutesToHm(satEnd),
    recreationHour:
      recre != null && recre > satStart && recre < satEnd
        ? formatMinutesToHm(recre)
        : hours.recreationHour,
  };
}

export function generateCourseStartSlotsForDay(
  hours: VacationClockHours,
  day: string,
): string[] {
  const resolved = resolveVacationHoursForDay(hours, day);
  return generateCourseStartSlots({
    startTime: resolved.startTime,
    endTime: resolved.endTime,
    durationCourse: resolved.durationCourse,
    recreationHour: resolved.recreationHour,
    recreationDuration: resolved.recreationDuration,
  });
}

export function buildVacationDisplaySlots(
  hours: VacationClockHours,
  day: string,
): { slots: string[]; recreationHour: string; endTime: string } {
  const resolved = resolveVacationHoursForDay(hours, day);
  const courseSlots = generateCourseStartSlotsForDay(hours, day);
  const recreationHour = resolved.recreationHour ?? "";
  const unique = new Set(courseSlots.filter(Boolean));
  if (recreationHour) unique.add(recreationHour);
  const slots = [...unique].sort(
    (a, b) => parseHmToMinutes(a) - parseHmToMinutes(b),
  );
  return {
    slots,
    recreationHour,
    endTime: resolved.endTime,
  };
}

/** Heure réelle d'une ligne de grille (indexée sur les horaires de semaine). */
export function slotHourOnDay(params: {
  day: string;
  weekdaySlot: string;
  weekdaySlots: string[];
  saturdaySlots: string[];
}): string {
  if (params.day !== "Samedi" || params.saturdaySlots.length === 0) {
    return params.weekdaySlot;
  }
  const index = params.weekdaySlots.indexOf(params.weekdaySlot);
  if (index < 0) return params.weekdaySlot;
  return params.saturdaySlots[index] ?? params.weekdaySlot;
}

export function hmToUtcTimeDate(hm: string): Date | null {
  const minutes = parseHmToMinutes(hm);
  if (!hm || !Number.isFinite(minutes)) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return new Date(Date.UTC(2000, 1, 1, hours, mins));
}
