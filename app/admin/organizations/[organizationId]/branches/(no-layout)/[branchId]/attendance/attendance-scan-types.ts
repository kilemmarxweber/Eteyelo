export type AttendancePersonType = "student" | "teacher" | "personnel";

export type AttendancePersonLookup = {
  id: string;
  name: string;
  matricule: string;
  roleLabel: string;
  personType: AttendancePersonType;
  expectedSessionLabel?: string | null;
  image?: string | null;
  alreadyCheckedIn?: boolean;
  canCheckOut?: boolean;
  attendanceId?: string | null;
  classeId?: string | null;
};

export type AttendanceCheckInClass = {
  id: string;
  name: string;
  code: string;
  level: string | null;
  cycle: string | null;
  studentCount: number;
  hasUpcomingSession: boolean;
  expectedSessionLabel?: string | null;
};

export type AttendanceCheckInLevel = {
  key: string;
  label: string;
  cycle: string | null;
  level: string | null;
  classes: AttendanceCheckInClass[];
};

export type AttendanceCheckInCycleGroup = {
  key: string;
  label: string;
  levels: AttendanceCheckInLevel[];
};

export type AttendanceQuickCheckInBootstrap = {
  teachers: AttendancePersonLookup[];
  cycles: AttendanceCheckInCycleGroup[];
  canViewPersonnel: boolean;
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
