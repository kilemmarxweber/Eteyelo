export type AttendancePdfLabels = {
  teacherSessionsTitle: string;
  dailyJournalTitle: string;
  studentRosterTitle: string;
  personnelRosterTitle: string;
  teacherAttendanceTitle: string;
  studentAttendanceTitle: string;
  personnelAttendanceTitle: string;
  period: string;
  teacherFilter: string;
  classFilter: string;
  sessionsSummary: string;
  dateLabel: string;
  dailyStats: string;
  earlyExitsStats: string;
  rosterSummary: string;
  noSessionPeriod: string;
  noTeacherSessionToday: string;
  noEarlyExit: string;
  noDataPeriod: string;
  earlyExitShort: string;
  exitPrefix: string;
  yes: string;
  no: string;
  emptyTeachers: string;
  emptyStudents: string;
  emptyPersonnel: string;
  summaryPresent: string;
  earlyExitLabel: string;
  personType: {
    student: string;
    teacher: string;
    personnel: string;
  };
  columns: {
    index: string;
    date: string;
    session: string;
    teacher: string;
    subject: string;
    class: string;
    start: string;
    end: string;
    duration: string;
    status: string;
    exitReason: string;
    type: string;
    name: string;
    context: string;
    arrival: string;
    departure: string;
    earlyExit: string;
    reason: string;
    present: string;
    absent: string;
    late: string;
    excused: string;
    total: string;
    personnel: string;
  };
};

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

export function buildAttendancePdfLabels(t: TranslateFn): AttendancePdfLabels {
  return {
    teacherSessionsTitle: t("pdf.teacherSessionsTitle"),
    dailyJournalTitle: t("pdf.dailyJournalTitle"),
    studentRosterTitle: t("pdf.studentRosterTitle"),
    personnelRosterTitle: t("pdf.personnelRosterTitle"),
    teacherAttendanceTitle: t("pdf.teacherAttendanceTitle"),
    studentAttendanceTitle: t("pdf.studentAttendanceTitle"),
    personnelAttendanceTitle: t("pdf.personnelAttendanceTitle"),
    period: t("pdf.period"),
    teacherFilter: t("pdf.teacherFilter"),
    classFilter: t("pdf.classFilter"),
    sessionsSummary: t("pdf.sessionsSummary"),
    dateLabel: t("pdf.dateLabel"),
    dailyStats: t("pdf.dailyStats"),
    earlyExitsStats: t("pdf.earlyExitsStats"),
    rosterSummary: t("pdf.rosterSummary"),
    noSessionPeriod: t("pdf.noSessionPeriod"),
    noTeacherSessionToday: t("pdf.noTeacherSessionToday"),
    noEarlyExit: t("pdf.noEarlyExit"),
    noDataPeriod: t("pdf.noDataPeriod"),
    earlyExitShort: t("pdf.earlyExitShort"),
    exitPrefix: t("pdf.exitPrefix"),
    yes: t("pdf.yes"),
    no: t("pdf.no"),
    emptyTeachers: t("pdf.emptyTeachers"),
    emptyStudents: t("pdf.emptyStudents"),
    emptyPersonnel: t("pdf.emptyPersonnel"),
    summaryPresent: t("pdf.summaryPresent"),
    earlyExitLabel: t("reports.earlyExitLabel"),
    personType: {
      student: t("personType.student"),
      teacher: t("personType.teacher"),
      personnel: t("personType.personnel"),
    },
    columns: {
      index: t("pdf.columns.index"),
      date: t("pdf.columns.date"),
      session: t("pdf.columns.session"),
      teacher: t("pdf.columns.teacher"),
      subject: t("pdf.columns.subject"),
      class: t("pdf.columns.class"),
      start: t("pdf.columns.start"),
      end: t("pdf.columns.end"),
      duration: t("pdf.columns.duration"),
      status: t("pdf.columns.status"),
      exitReason: t("pdf.columns.exitReason"),
      type: t("pdf.columns.type"),
      name: t("pdf.columns.name"),
      context: t("pdf.columns.context"),
      arrival: t("pdf.columns.arrival"),
      departure: t("pdf.columns.departure"),
      earlyExit: t("pdf.columns.earlyExit"),
      reason: t("pdf.columns.reason"),
      present: t("stats.present"),
      absent: t("stats.absent"),
      late: t("stats.late"),
      excused: t("stats.excused"),
      total: t("stats.total"),
      personnel: t("pdf.columns.personnel"),
    },
  };
}

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );
}

export function formatPdfPeriod(
  labels: AttendancePdfLabels,
  start: string,
  end: string,
): string {
  return fill(labels.period, { start, end });
}

export function formatPdfSummaryPresent(
  labels: AttendancePdfLabels,
  summary: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
  },
): string {
  return fill(labels.summaryPresent, summary);
}
