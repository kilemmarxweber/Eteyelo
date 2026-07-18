import type { AttendanceStatus } from "@/prisma/generated/prisma/client";

export type AttendancePeriod = "today" | "week" | "month" | "year";

export type AttendanceReportFilters = {
  period?: AttendancePeriod;
  month?: number;
  year?: number;
  status?: AttendanceStatus | "ALL";
  search?: string;
};

export type AttendanceReportStats = {
  records: number;
  presences: number;
  absences: number;
  checkedIn: number;
  notCheckedIn: number;
};

export type AttendanceRecentItem = {
  id: string;
  dateLabel: string;
  name: string;
  timeLabel: string;
  status: AttendanceStatus;
  statusLabel: string;
};

export type AttendanceWeekdayStat = {
  day: string;
  present: number;
  total: number;
  percent: number;
};

export type AttendanceHourStat = {
  hour: number;
  count: number;
};

export type AttendanceReportRow = {
  id: string;
  date: string;
  dayLabel: string;
  agentName: string;
  agentInitials: string;
  agentId: string;
  poste: string;
  status: AttendanceStatus;
  statusLabel: string;
  arrival: string | null;
  departure: string | null;
};

export type AttendanceReportData = {
  stats: AttendanceReportStats;
  recent: AttendanceRecentItem[];
  weekdayStats: AttendanceWeekdayStat[];
  hourStats: AttendanceHourStat[];
  rows: AttendanceReportRow[];
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Présent",
  ABSENT: "Absent",
  LATE: "Retard",
  EXCUSED: "Excusé",
};

export const ATTENDANCE_PERIOD_OPTIONS: Array<{
  value: AttendancePeriod;
  label: string;
}> = [
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "Cette semaine" },
  { value: "month", label: "Ce mois" },
  { value: "year", label: "Cette année" },
];

export const MONTH_OPTIONS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];
