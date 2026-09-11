/** Fuseau horaire des établissements (RDC). Surcharge possible via APP_TIMEZONE. */
export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "Africa/Kinshasa";
const TIMEZONE = APP_TIMEZONE;

export const TEACHER_CHECK_IN_MINUTES_BEFORE = 15;
export const TEACHER_CHECK_IN_MINUTES_AFTER_START = 10;
export const TEACHER_COURSE_DURATION_MINUTES = 45;

function getZonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  return {
    hour: Number(parts.find((p) => p.type === "hour")?.value),
    minute: Number(parts.find((p) => p.type === "minute")?.value),
  };
}

/** Minutes since midnight in the fuseau applicatif pour un instant. */
export function toMinutes(date: Date) {
  const { hour, minute } = getZonedParts(date);
  return hour * 60 + minute;
}

/**
 * Minutes since midnight for schedule @db.Time values.
 * These are stored as UTC wall-clock times (see parseScheduleHour).
 */
export function scheduleHourToMinutes(hour: Date) {
  return hour.getUTCHours() * 60 + hour.getUTCMinutes();
}

export function getAppWeekday(date: Date = new Date()) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
  }).format(date);

  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return map[weekday] ?? 0;
}

export function startOfTodayInTimezone(date: Date = new Date()) {
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function isTeacherCheckInWindow(
  currentMinutes: number,
  startMinutes: number,
  courseDurationMinutes = TEACHER_COURSE_DURATION_MINUTES,
) {
  const end = startMinutes + courseDurationMinutes;
  return (
    currentMinutes >= startMinutes - TEACHER_CHECK_IN_MINUTES_BEFORE &&
    currentMinutes <= end + TEACHER_CHECK_IN_MINUTES_AFTER_START
  );
}

/** @deprecated Utiliser getAppWeekday */
export const getParisWeekday = getAppWeekday;

/** @deprecated Utiliser startOfTodayInTimezone */
export const startOfTodayParis = startOfTodayInTimezone;

export function nowLocal() {
  return new Date();
}

/**
 * Prisma @db.Time → 1970-01-01 UTC ; hmToUtcTimeDate → 2000-02-01 UTC.
 * Ce ne sont pas des instants réels : l'heure UTC *est* l'heure affichée.
 */
export function isUtcWallClockTime(date: Date): boolean {
  return date.getUTCFullYear() < 2010;
}

/** Minutes depuis minuit, que la Date soit un Time UTC ou un horodatage réel. */
export function clockMinutesOf(date: Date): number {
  return isUtcWallClockTime(date)
    ? scheduleHourToMinutes(date)
    : toMinutes(date);
}

/** Présent si pointage ≤ heure de début ; retard dès la minute suivante. */
export function resolveCheckInStatus(
  start: Date,
  at: Date = nowLocal(),
): "PRESENT" | "LATE" {
  return clockMinutesOf(at) > clockMinutesOf(start) ? "LATE" : "PRESENT";
}

export function formatClockTime(
  date: Date | null | undefined,
  options?: { withSeconds?: boolean; locale?: string },
): string | null {
  if (!date) return null;
  const locale = options?.locale ?? "fr-FR";
  if (isUtcWallClockTime(date)) {
    const h = String(date.getUTCHours()).padStart(2, "0");
    const m = String(date.getUTCMinutes()).padStart(2, "0");
    if (!options?.withSeconds) return `${h}:${m}`;
    const s = String(date.getUTCSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }
  return date.toLocaleTimeString(locale, {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    ...(options?.withSeconds ? { second: "2-digit" as const } : {}),
  });
}

/** Time-only Date (année 2000 UTC) à partir de minutes depuis minuit. */
export function minutesToUtcWallClock(minutes: number): Date {
  const safe = Math.max(0, Math.round(minutes));
  return new Date(
    Date.UTC(2000, 1, 1, Math.floor(safe / 60), safe % 60),
  );
}
