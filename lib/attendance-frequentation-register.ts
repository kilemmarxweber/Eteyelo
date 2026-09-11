import { formatClockTime } from "@/lib/timezone";

export type FrequentationMark = "" | "I" | "O" | "M" | "R";

export type FrequentationDayCell = {
  day: number;
  iso: string;
  schoolDay: boolean;
  mark: FrequentationMark;
};

export type FrequentationStudentRow = {
  personId: string;
  personName: string;
  days: FrequentationDayCell[];
  presentCount: number;
  absentCount: number;
  arrival: string | null;
  departure: string | null;
  observation: string | null;
};

export type FrequentationMonthPage = {
  year: number;
  month: number;
  monthLabel: string;
  daysInMonth: number;
  openDays: number;
  students: FrequentationStudentRow[];
  presenceMonth: number;
  presencePrevious: number;
  classDaysPrevious: number;
  averageAttendance: number | null;
};

export type FrequentationAverageRow = {
  month: number;
  year: number;
  monthLabel: string;
  enrolled: number;
  classDaysMonth: number;
  classDaysYear: number;
  presenceMonth: number;
  presenceYear: number;
  average: number | null;
};

export type FrequentationRegister = {
  schoolYearLabel: string;
  classeId: string | null;
  classeName: string | null;
  months: FrequentationMonthPage[];
  averages: FrequentationAverageRow[];
};

export function frequentationMark(params: {
  schoolDay: boolean;
  isFuture: boolean;
  checkIn: Date | null;
  status: string | null;
  exitReasonCode?: string | null;
  exitReason?: string | null;
}): FrequentationMark {
  if (!params.schoolDay || params.isFuture) return "";
  const presentLike =
    Boolean(params.checkIn) ||
    params.status === "PRESENT" ||
    params.status === "LATE";
  if (presentLike) return "I";
  if (params.status === "EXCUSED") {
    const blob = `${params.exitReasonCode ?? ""} ${params.exitReason ?? ""}`.toUpperCase();
    if (blob.includes("MALADIE")) return "M";
    return "R";
  }
  return "O";
}

export function formatFrequentationTime(date: Date | null | undefined): string | null {
  return formatClockTime(date);
}

export function buildObservation(params: {
  arrival: string | null;
  departure: string | null;
  earlyExit: boolean;
  exitReason: string | null;
}): string | null {
  const parts: string[] = [];
  if (params.arrival) parts.push(`Arr. ${params.arrival}`);
  if (params.departure) {
    parts.push(
      params.earlyExit
        ? `Sortie ant. ${params.departure}`
        : `Sort. ${params.departure}`,
    );
  }
  if (params.earlyExit && params.exitReason) parts.push(params.exitReason);
  return parts.length ? parts.join(" · ") : null;
}
