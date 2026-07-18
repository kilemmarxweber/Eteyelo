import type { ReleveNotesData } from "@/lib/releve-notes-builder";

type FicheNote = {
  studentId?: string;
  nom?: string;
  studentSurname?: string;
  studentusername?: string;
  studentnaissance?: string;
  studentclasse?: string;
  studentSexe?: string;
  score?: number | null;
  maxScore?: number | null;
  comment?: string;
};

type RawFiche = {
  id: string;
  typeFiche: string;
  status: boolean;
  dateCreated: Date;
  coursName: string;
  periodeName: string;
  anneeName: string;
  notes: string;
  autres: string;
  lesson?: {
    cours?: {
      nameCours?: string | null;
    } | null;
  } | null;
  period?: {
    label?: string | null;
  } | null;
  teacher?: {
    branchMember?: {
      member?: {
        user?: {
          name?: string | null;
          postnom?: string | null;
          prenom?: string | null;
        } | null;
      } | null;
    } | null;
  } | null;
};

export type StudentIntervention = {
  id: string;
  ficheId: string;
  typeFiche: string;
  subjectName: string;
  periodName: string;
  dateLabel: string;
  score: number | null;
  maxScore: number;
  percentage: number | null;
  teacherName: string;
  validated: boolean;
};

export type StudentSubjectScore = {
  id: string;
  subjectName: string;
  periodName: string;
  score: number;
  maxScore: number;
  percentage: number;
  validated: boolean;
};

export type StudentDocumentPeriod = {
  id: number;
  label: string;
};

export type StudentDocumentsData = {
  pendingInterventions: StudentIntervention[];
  validatedScores: StudentSubjectScore[];
  periods: StudentDocumentPeriod[];
  releveData: ReleveNotesData | null;
  organizationName: string;
  branchName: string;
  schoolYear: string;
  schoolYearId: string;
  className: string;
  studentName: string;
  matricule: string;
  relevesHref: string;
  resultsHref: string;
};

export function createEmptyStudentDocumentsData(
  overrides: Partial<StudentDocumentsData> = {},
): StudentDocumentsData {
  return {
    pendingInterventions: [],
    validatedScores: [],
    periods: [],
    releveData: null,
    organizationName: "",
    branchName: "",
    schoolYear: "",
    schoolYearId: "",
    className: "",
    studentName: "",
    matricule: "",
    relevesHref: "#",
    resultsHref: "#",
    ...overrides,
  };
}

function safeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function parseNotes(raw: string | null | undefined): FicheNote[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatTeacherName(
  user?: {
    name?: string | null;
    postnom?: string | null;
    prenom?: string | null;
  } | null,
) {
  if (!user) return "-";
  return [user.name, user.postnom, user.prenom].filter(Boolean).join(" ").trim() || "-";
}

function getSubjectName(fiche: RawFiche) {
  return (
    fiche.lesson?.cours?.nameCours?.trim() ||
    fiche.coursName?.trim() ||
    "Matiere"
  );
}

function getPeriodName(fiche: RawFiche) {
  return fiche.period?.label?.trim() || fiche.periodeName?.trim() || "-";
}

function getPercentage(score: number | null | undefined, maxScore: number) {
  if (score == null || maxScore <= 0) return null;
  return Number(((score / maxScore) * 100).toFixed(1));
}

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function buildStudentDocumentsData(params: {
  studentId: string;
  fiches: RawFiche[];
  periods: StudentDocumentPeriod[];
  organizationName: string;
  branchName: string;
  schoolYear: string;
  schoolYearId: string;
  className: string;
  studentName: string;
  matricule: string;
  classLevel?: string | null;
  optionName?: string | null;
  sectionName?: string | null;
  relevesHref: string;
  resultsHref: string;
  releveData?: ReleveNotesData | null;
  studentIdentity?: {
    nom: string;
    postnom: string;
    prenom: string;
    sexe: string;
    classLabel: string;
    birthDate?: Date | string | null;
  };
}): StudentDocumentsData {
  const {
    studentId,
    fiches,
    periods,
    organizationName,
    branchName,
    schoolYear,
    schoolYearId,
    className,
    studentName,
    matricule,
    classLevel,
    optionName,
    sectionName,
    relevesHref,
    resultsHref,
    releveData,
  } = params;

  const pendingInterventions: StudentIntervention[] = [];
  const validatedScores: StudentSubjectScore[] = [];

  for (const fiche of fiches) {
    const notes = parseNotes(fiche.notes).filter((note) => note.studentId === studentId);
    if (!notes.length) continue;

    const subjectName = getSubjectName(fiche);
    const periodName = getPeriodName(fiche);
    const teacherName = formatTeacherName(fiche.teacher?.branchMember?.member?.user);

    if (fiche.typeFiche !== "ficheCote") {
      if (fiche.status) continue;

      for (const note of notes) {
        const maxScore = safeNumber(note.maxScore);
        const score = note.score == null ? null : safeNumber(note.score);

        pendingInterventions.push({
          id: `${fiche.id}-${studentId}`,
          ficheId: fiche.id,
          typeFiche: fiche.typeFiche,
          subjectName,
          periodName,
          dateLabel: formatDateLabel(fiche.dateCreated),
          score,
          maxScore,
          percentage: getPercentage(score, maxScore),
          teacherName,
          validated: false,
        });
      }
      continue;
    }

    if (!fiche.status) continue;

    for (const note of notes) {
      const maxScore = safeNumber(note.maxScore);
      const score = safeNumber(note.score);
      const percentage = getPercentage(score, maxScore) ?? 0;

      validatedScores.push({
        id: `${fiche.id}-${subjectName}-${periodName}`,
        subjectName,
        periodName,
        score,
        maxScore,
        percentage,
        validated: true,
      });
    }
  }

  pendingInterventions.sort((a, b) => b.dateLabel.localeCompare(a.dateLabel, "fr"));
  validatedScores.sort((a, b) => {
    const periodCompare = a.periodName.localeCompare(b.periodName, "fr");
    if (periodCompare !== 0) return periodCompare;
    return a.subjectName.localeCompare(b.subjectName, "fr");
  });

  const resolvedReleveData =
    releveData ??
    buildStudentReleveFromScores({
      studentId,
      studentName,
      matricule,
      className,
      classLevel,
      optionName,
      sectionName,
      schoolYearName: schoolYear,
      schoolYearId,
      validatedScores,
    });

  return {
    pendingInterventions: pendingInterventions,
    validatedScores: validatedScores,
    periods: periods,
    releveData: resolvedReleveData,
    organizationName: organizationName,
    branchName: branchName,
    schoolYear: schoolYear,
    schoolYearId: schoolYearId,
    className: className,
    studentName: studentName,
    matricule: matricule,
    relevesHref: relevesHref,
    resultsHref: resultsHref,
  };
}

function buildStudentReleveFromScores(params: {
  studentId: string;
  studentName: string;
  matricule: string;
  className: string;
  classLevel?: string | null;
  optionName?: string | null;
  sectionName?: string | null;
  schoolYearName: string;
  schoolYearId: string;
  validatedScores: StudentSubjectScore[];
  periodName?: string | null;
}): ReleveNotesData | null {
  const scores = params.periodName
    ? params.validatedScores.filter(
        (score) => score.periodName === params.periodName,
      )
    : params.validatedScores;

  if (!scores.length) return null;

  const periodMap = new Map<string, StudentSubjectScore[]>();
  for (const score of scores) {
    const list = periodMap.get(score.periodName) ?? [];
    list.push(score);
    periodMap.set(score.periodName, list);
  }

  const semesters = Array.from(periodMap.entries())
    .sort(([left], [right]) => left.localeCompare(right, "fr"))
    .map(([periodName, periodScores], index) => {
      const courses = periodScores.map((score, courseIndex) => ({
        courseId: score.id,
        courseCode: `M${courseIndex + 1}`,
        courseName: score.subjectName,
        credits: 1,
        score: score.score,
        maxScore: score.maxScore,
        percentage: score.percentage,
      }));

      const semesterAverage =
        courses.reduce((sum, course) => sum + course.percentage, 0) /
        courses.length;

      return {
        semesterLabel: periodName,
        semesterOrder: index + 1,
        courses,
        semesterAverage: Math.round(semesterAverage * 100) / 100,
      };
    });

  const allCourses = semesters.flatMap((semester) => semester.courses);
  const overallAverage =
    allCourses.reduce((sum, course) => sum + course.percentage, 0) /
    allCourses.length;

  return {
    studentId: params.studentId,
    studentName: params.studentName,
    username: params.matricule,
    auditoireName: params.className,
    auditoireLevel: params.classLevel ?? null,
    filiereName: params.optionName ?? null,
    faculteName: params.sectionName ?? null,
    schoolYearName: params.schoolYearName,
    schoolYearId: params.schoolYearId,
    semesters,
    overallAverage: Math.round(overallAverage * 100) / 100,
  };
}

export function buildStudentReleveForPeriod(
  documents: StudentDocumentsData,
  periodName: string | null,
): ReleveNotesData | null {
  if (documents.releveData && !periodName) {
    return documents.releveData;
  }

  return buildStudentReleveFromScores({
    studentId: documents.releveData?.studentId ?? "",
    studentName: documents.studentName,
    matricule: documents.matricule,
    className: documents.className,
    classLevel: documents.releveData?.auditoireLevel ?? null,
    optionName: documents.releveData?.filiereName ?? null,
    sectionName: documents.releveData?.faculteName ?? null,
    schoolYearName: documents.schoolYear,
    schoolYearId: documents.schoolYearId,
    validatedScores: documents.validatedScores,
    periodName,
  });
}

export function filterStudentDocumentsByPeriod<
  T extends { periodName: string },
>(items: T[], periodName: string | null) {
  if (!periodName) return items;
  return items.filter((item) => item.periodName === periodName);
}
