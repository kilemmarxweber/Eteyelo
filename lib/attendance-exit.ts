import type { AttendanceExitReason } from "@/prisma/generated/prisma/client";
import { scheduleHourToMinutes, toMinutes } from "@/lib/timezone";

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
