export type AttendancePersonType = "student" | "teacher" | "personnel";

export type AttendancePersonLookup = {
  id: string;
  name: string;
  matricule: string;
  roleLabel: string;
  personType: AttendancePersonType;
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
};

/** @deprecated Use AttendancePersonLookup */
export type AttendanceStudentLookup = AttendancePersonLookup;
