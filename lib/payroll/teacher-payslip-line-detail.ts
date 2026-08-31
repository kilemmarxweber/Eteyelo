/** Snapshot figé d’une séance sur une ligne de bulletin de paie. */
export type TeacherPayslipLineDetailSnapshot = {
  startTime: string;
  endTime: string;
  plannedMinutes: number;
  lateMinutes: number;
  earlyExitMinutes: number;
  lostMinutes: number;
  checkIn: string | null;
  checkOut: string | null;
  status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";
  className: string;
  courseName: string;
  graceMinutes: number;
  reason: "ABSENCE" | "LATE" | "EARLY_EXIT" | null;
};
