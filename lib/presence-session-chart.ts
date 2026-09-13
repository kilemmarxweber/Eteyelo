import { APP_TIMEZONE, startOfTodayInTimezone } from "@/lib/timezone";

export const PRESENCE_CHART_DAYS = 7;
export const DEFAULT_PERSONNEL_DAY_MINUTES = 480;

export type PresenceSeriesPoint = {
  date: string;
  count: number;
};

export type PresenceChartStats = {
  todayCount: number;
  totalCount: number;
  series: PresenceSeriesPoint[];
};

const PRESENT_LIKE = new Set(["PRESENT", "LATE", "EXCUSED"]);

export function calendarDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function presenceChartRange(days = PRESENCE_CHART_DAYS) {
  const today = startOfTodayInTimezone();
  const start = new Date(today.getTime() - (days - 1) * 86_400_000);
  const keys: string[] = [];
  for (let i = 0; i < days; i += 1) {
    keys.push(
      new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10),
    );
  }
  return {
    start,
    end: new Date(today.getTime() + 86_400_000 - 1),
    todayKey: today.toISOString().slice(0, 10),
    keys,
  };
}

export function emptyPresenceSeries(keys: string[]): PresenceSeriesPoint[] {
  return keys.map((date) => ({ date, count: 0 }));
}

export function isPresentLikeStatus(status: string) {
  return PRESENT_LIKE.has(status);
}

function roundHours(value: number) {
  return Math.round(value * 10) / 10;
}

/** Heures travaillées d’une journée personnel, plafonnées à la durée prévue (8 h par défaut). */
export function personnelWorkedHours(
  row: {
    status: string;
    checkIn: Date | null;
    checkOut: Date | null;
    date: Date;
  },
  dayMinutes: number,
  now: Date,
  todayKey: string,
) {
  const capHours = Math.max(1, dayMinutes) / 60;
  const key = calendarDateKey(row.date);
  if (row.status === "EXCUSED") return roundHours(capHours);
  if (row.status === "ABSENT" && !row.checkIn) return 0;
  if (!row.checkIn) return 0;

  const isToday = key === todayKey;
  const end = row.checkOut ?? (isToday ? now : null);
  if (!end) {
    return isPresentLikeStatus(row.status) ? roundHours(capHours) : 0;
  }

  const minutes = Math.max(0, (end.getTime() - row.checkIn.getTime()) / 60_000);
  return roundHours(Math.min(capHours, minutes / 60));
}
