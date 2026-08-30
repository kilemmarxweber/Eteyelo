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
  /** 1 = Monday … 6 = Saturday */
  dayIndex: number;
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
