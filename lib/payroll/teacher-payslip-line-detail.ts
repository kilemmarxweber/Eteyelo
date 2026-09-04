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
  /** Valeur réelle de la séance (part du brut mensuel ou tarif secondaire). */
  sessionGross?: number;
  /** Retard dans la franchise : signalé, sans retenue. */
  lateWithinGrace?: boolean;
  /** Retenue volontairement retirée par le propriétaire. */
  waived?: boolean;
  waivedAmount?: number;
};

export function parsePayslipLineDetail(
  value: unknown,
): TeacherPayslipLineDetailSnapshot | null {
  if (!value || typeof value !== "object") return null;
  return value as TeacherPayslipLineDetailSnapshot;
}

export function isPayslipLineWaived(detail: unknown): boolean {
  return parsePayslipLineDetail(detail)?.waived === true;
}

export function waivedSessionIdsFromLines(
  lines: Array<{ sessionId: string | null; detail: unknown }>,
): string[] {
  return lines
    .filter((line) => line.sessionId && isPayslipLineWaived(line.detail))
    .map((line) => line.sessionId as string);
}
