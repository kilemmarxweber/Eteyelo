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
  reference: string;
  submittedAt: string;
  yearsOfExperience: number | null;
  assignmentYearLabels: string[];
  desiredSubjects: string | null;
  desiredLevels: string | null;
  availability: string | null;
  experienceSummary: string | null;
  educationSummary: string | null;
  skills: string | null;
  motivation: string | null;
  cvUrl: string;
  coverLetterUrl: string;
};

export type TeacherProfileStats = {
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceTotal: number;
  presenceRate: number;
  notesCount: number;
  assignmentsCount: number;
  courseCount: number;
  classCount: number;
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
  image: string | null;
  statusActive: boolean;
  statusLabel: string;
  isTitulaire: boolean;
  schoolYearLabel: string | null;
  baseHref: string;
  listHref: string;
  notesHref: string;
  notesListHref: string;
  devoirsHref: string;
  attendanceHref: string;
  calendarHref: string;
  branchType: string;
  assignmentYearCount: number;
  assignmentYearLabels: string[];
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
