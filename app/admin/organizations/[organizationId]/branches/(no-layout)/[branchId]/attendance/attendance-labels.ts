import type { AttendanceStatus } from "@/prisma/generated/prisma/client";

import type { AttendancePeriod } from "./attendance-report-types";

export const ATTENDANCE_PERIOD_VALUES: AttendancePeriod[] = [
  "today",
  "week",
  "month",
  "year",
];

export const MONTH_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

export function getAttendanceStatusLabel(
  t: (key: string) => string,
  status: AttendanceStatus,
): string {
  return t(`status.${status}`);
}

/** ISO-style weekday index: 1 = Monday … 6 = Saturday */
export const CHART_WEEKDAY_INDICES = [1, 2, 3, 4, 5, 6] as const;

export function weekdayIndexFromDate(date: Date): number | null {
  const day = date.getDay();
  if (day === 0) return null;
  return day;
}

export function formatWeekdayLabel(
  dayIndex: number,
  locale: string,
  style: "long" | "short" = "long",
): string {
  const date = new Date(2024, 0, dayIndex);
  return new Intl.DateTimeFormat(locale, { weekday: style }).format(date);
}
