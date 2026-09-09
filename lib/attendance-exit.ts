import type { AttendanceExitReason } from "@/prisma/generated/prisma/client";
import {
  getParisWeekday,
  nowLocal,
  scheduleHourToMinutes,
  toMinutes,
} from "@/lib/timezone";
import {
  hmToUtcTimeDate,
  resolveVacationHoursForDay,
} from "@/lib/creneau-saturday";

const DAY_BY_WEEKDAY = {
  0: "Dimanche",
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
  6: "Samedi",
} as const;

function dateToHm(value: Date | null | undefined) {
  if (!value) return "";
  return `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`;
}

export function resolveCreneauClockHours(
  creneau: { startTime: Date; endTime: Date },
  now = nowLocal(),
) {
  const day = DAY_BY_WEEKDAY[getParisWeekday(now) as keyof typeof DAY_BY_WEEKDAY];
  return resolveVacationHoursForDay(
    {
      startTime: dateToHm(creneau.startTime),
      endTime: dateToHm(creneau.endTime),
      durationCourse: 45,
    },
    day,
  );
}

/** Sortie normale = à l'heure de fin du créneau (pas avant). */
export function isAtOrAfterCreneauEnd(
  creneau: { startTime: Date; endTime: Date },
  now = nowLocal(),
) {
  const resolved = resolveCreneauClockHours(creneau, now);
  const end = hmToUtcTimeDate(resolved.endTime);
  if (!end) return true;
  return toMinutes(now) >= scheduleHourToMinutes(end);
}

export function creneauStartTimeDate(
  creneau: { startTime: Date; endTime: Date },
  now = nowLocal(),
) {
  const resolved = resolveCreneauClockHours(creneau, now);
  return hmToUtcTimeDate(resolved.startTime) ?? creneau.startTime;
}

export function creneauEndTimeDate(
  creneau: { startTime: Date; endTime: Date },
  now = nowLocal(),
) {
  const resolved = resolveCreneauClockHours(creneau, now);
  return hmToUtcTimeDate(resolved.endTime) ?? creneau.endTime;
}

export const ATTENDANCE_EXIT_REASON_LABELS: Record<
  AttendanceExitReason,
  string
> = {
  MALADIE: "Maladie",
  URGENCE: "Urgence",
  AUTORISE: "Sortie autorisée",
  AUTRE: "Autre motif",
};

export const ATTENDANCE_EXIT_REASON_OPTIONS = (
  Object.keys(ATTENDANCE_EXIT_REASON_LABELS) as AttendanceExitReason[]
).map((value) => ({
  value,
  label: ATTENDANCE_EXIT_REASON_LABELS[value],
}));

export function formatSessionOrdinal(index: number): string {
  const n = index + 1;
  if (n === 1) return "1ère séance";
  return `${n}e séance`;
}

export function formatDurationMinutes(minutes: number | null | undefined): string {
  if (minutes == null || Number.isNaN(minutes) || minutes < 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m.toString().padStart(2, "0")}`;
}

/** Heure du jour en minutes, que la Date soit un @db.Time (1970 UTC) ou un horodatage réel. */
export function clockMinutesOf(date: Date): number {
  if (date.getUTCFullYear() < 1990) {
    return scheduleHourToMinutes(date);
  }
  return toMinutes(date);
}

export function minutesBetween(start: Date | null, end: Date | null): number | null {
  if (!start || !end) return null;
  const diff = clockMinutesOf(end) - clockMinutesOf(start);
  return diff >= 0 ? diff : null;
}

/** Applique l'heure Time (UTC) d'un créneau sur une date locale. */
export function combineDateWithCreneauTime(day: Date, time: Date): Date {
  const result = new Date(day);
  result.setHours(
    time.getUTCHours(),
    time.getUTCMinutes(),
    time.getUTCSeconds(),
    0,
  );
  return result;
}
