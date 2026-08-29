import type { StaffBadgeData } from "@/lib/staff-badge";

export type TeacherAttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export type TeacherProfileCourse = {
  id: string;
  teachingId: string;
  courseName: string;
  classId: string;
  className: string;
  classCode: string;
  titulaire: boolean;
};

export type TeacherProfileClass = {
  id: string;
  name: string;
  code: string;
};

export type TeacherProfileNote = {
  id: string;
  lessonId: string;
  classId: string;
  className: string;
  courseName: string;
  typeFiche: string;
  periodName: string;
  yearName: string;
  status: boolean;
  createdAt: string;
};

export type TeacherProfileAttendance = {
  id: string;
  date: string;
  status: TeacherAttendanceStatus;
  checkIn: string | null;
  checkOut: string | null;
  remark: string | null;
  courseName: string;
  className: string;
};

export type TeacherProfileMeeting = {
  id: string;
  title: string;
  dateStart: string;
  dateEnd: string | null;
  location: string | null;
  typeName: string | null;
  className: string | null;
  courseName: string | null;
  upcoming: boolean;
};

export type TeacherProfileApplication = {
  id: string;
  reference: string;
  submittedAt: string;
  yearsOfExperience: number | null;
  assignmentYearLabels: string[];
  /** Matières affichées (affectation actuelle ou dépôt). */
  desiredSubjects: string | null;
  subjectsSource: "assignment" | "deposit" | "none";
  /** Matières d’origine au dépôt (toujours conservées). */
  depositSubjects: string | null;
  desiredLevels: string | null;
  levelsSource: "assignment" | "deposit" | "none";
  depositLevels: string | null;
  /** Actif / Renvoyé / N'est plus actif (auto). */
  availability: string | null;
  availabilitySource: "auto";
  experienceSummary: string | null;
  educationSummary: string | null;
  skills: string | null;
  motivation: string | null;
  cvUrl: string;
  coverLetterUrl: string;
  parcours: TeacherParcoursYear[];
};

export type TeacherParcoursYear = {
  yearId: string;
  yearLabel: string;
  startYear: string;
  isCurrent: boolean;
  items: {
    courseName: string;
    className: string;
    classCode: string;
    level: string | null;
    titulaire: boolean;
  }[];
  subjects: string[];
  levels: string[];
};

export type TeacherProfileStats = {
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceTotal: number;
  presenceRate: number;
  punctualityRate: number;
  notesCount: number;
  assignmentsCount: number;
  courseCount: number;
  classCount: number;
  /** Score 0–100 basé sur cours affectés / donnés. */
  coursesRate: number;
  /** Score 0–100 basé sur interventions (fiches / devoirs). */
  interventionsRate: number;
  score: number;
};

export type TeacherProfileData = {
  teacherId: string;
  teacherLabel: string;
  teacherLabelLower: string;
  fullName: string;
  nom: string;
  prenom: string;
  postnom: string;
  email: string;
  telephone: string;
  address: string;
  username: string;
  sexe: string;
  dateOfBirthLabel: string;
  ageLabel: string;
  image: string | null;
  statusActive: boolean;
  statusLabel: string;
  isTitulaire: boolean;
  schoolYearLabel: string | null;
  baseHref: string;
  listHref: string;
  dashboardHref: string;
  notesHref: string;
  notesListHref: string;
  devoirsHref: string;
  attendanceHref: string;
  calendarHref: string;
  branchType: string;
  assignmentYearCount: number;
  assignmentYearLabels: string[];
  /** Propriétaire : peut remplacer CV / lettre. */
  canEditApplicationDocuments: boolean;
  courses: TeacherProfileCourse[];
  classes: TeacherProfileClass[];
  application: TeacherProfileApplication | null;
  notes: TeacherProfileNote[];
  attendances: TeacherProfileAttendance[];
  meetings: TeacherProfileMeeting[];
  stats: TeacherProfileStats;
  badge: StaffBadgeData | null;
  currentSessions: unknown[];
};
