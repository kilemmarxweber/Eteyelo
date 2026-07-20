/** Fuseau horaire des établissements (RDC). Surcharge possible via APP_TIMEZONE. */
const TIMEZONE = process.env.APP_TIMEZONE ?? "Africa/Kinshasa";

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
