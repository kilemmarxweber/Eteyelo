export type AttendancePersonType = "student" | "teacher" | "personnel";

export type AttendancePersonLookup = {
  id: string;
  name: string;
  matricule: string;
  roleLabel: string;
  personType: AttendancePersonType;
  expectedSessionLabel?: string | null;
  image?: string | null;
};

export type AttendanceCheckInResult = {
  ok: boolean;
  message: string;
  personType?: AttendancePersonType;
  person?: AttendancePersonLookup;
  status?: "PRESENT" | "LATE";
  statusLabel?: string;
  sessionLabel?: string;
  checkedAt?: string;
  /** Déjà pointé à l'arrivée : le client doit encoder la sortie. */
  needsCheckout?: boolean;
  attendanceId?: string;
};

/** @deprecated Use AttendancePersonLookup */
export type AttendanceStudentLookup = AttendancePersonLookup;
