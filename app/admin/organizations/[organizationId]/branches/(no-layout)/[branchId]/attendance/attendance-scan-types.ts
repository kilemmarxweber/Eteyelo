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

export type AttendanceLiveCheckInState = {
  personType: AttendancePersonType;
  personId: string;
  alreadyCheckedIn: boolean;
  canCheckOut: boolean;
  attendanceId: string | null;
};

export type AttendanceLiveRecentItem = {
  personType: AttendancePersonType;
  personId: string;
  personName: string;
  status?: "PRESENT" | "LATE";
  statusLabel?: string;
  checkedAt: string;
  attendanceId?: string;
};

export type AttendanceLiveSnapshot = {
  states: AttendanceLiveCheckInState[];
  recent: AttendanceLiveRecentItem[];
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
  /** False = seule une sortie anticipée (incident) est possible. */
  normalCheckoutAllowed?: boolean;
};

export type AttendanceFaceMatchResult =
  | {
      matched: true;
      personType: AttendancePersonType;
      personId: string;
      person: AttendancePersonLookup;
    }
  | { matched: false; reason: "none" | "ambiguous" };

/** @deprecated Use AttendancePersonLookup */
export type AttendanceStudentLookup = AttendancePersonLookup;
