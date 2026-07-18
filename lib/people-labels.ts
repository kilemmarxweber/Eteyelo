import {
  isCentreFormationBranch,
  isUniversiteBranch,
} from "@/lib/branch-capabilities";

export type PeopleLabels = {
  student: string;
  studentPlural: string;
  studentLower: string;
  studentPluralLower: string;
  teacher: string;
  teacherPlural: string;
  teacherLower: string;
  teacherPluralLower: string;
};

function withLower(
  labels: Pick<
    PeopleLabels,
    "student" | "studentPlural" | "teacher" | "teacherPlural"
  >,
): PeopleLabels {
  return {
    ...labels,
    studentLower: labels.student.toLowerCase(),
    studentPluralLower: labels.studentPlural.toLowerCase(),
    teacherLower: labels.teacher.toLowerCase(),
    teacherPluralLower: labels.teacherPlural.toLowerCase(),
  };
}

const SCHOOL_LABELS = withLower({
  student: "Élève",
  studentPlural: "Élèves",
  teacher: "Enseignant",
  teacherPlural: "Enseignants",
});

/** Libellés par defaut (primaire, secondaire, atelier). */
export const DEFAULT_PEOPLE_LABELS: PeopleLabels = SCHOOL_LABELS;

const TRAINING_LABELS = withLower({
  student: "Apprenant",
  studentPlural: "Apprenants",
  teacher: "Enseignant",
  teacherPlural: "Enseignants",
});

const UNIVERSITY_LABELS = withLower({
  student: "Étudiant",
  studentPlural: "Étudiants",
  teacher: "Professeur",
  teacherPlural: "Professeurs",
});

export function getPeopleLabels(typebranch: unknown): PeopleLabels {
  if (isUniversiteBranch(typebranch)) {
    return UNIVERSITY_LABELS;
  }

  if (isCentreFormationBranch(typebranch)) {
    return TRAINING_LABELS;
  }

  return SCHOOL_LABELS;
}

/** Libellés université (Étudiant, Professeur) — uniquement pour UNIVERSITE. */
export function getUniversityPeopleLabels(): PeopleLabels {
  return UNIVERSITY_LABELS;
}

export function pluralizeLabel(
  singular: string,
  plural: string,
  count: number,
): string {
  return count === 1 ? singular : plural;
}

export function pluralizeStudentLabel(
  labels: Pick<PeopleLabels, "student" | "studentPlural">,
  count: number,
): string {
  return pluralizeLabel(labels.student, labels.studentPlural, count);
}

export function pluralizeStudentLabelLower(
  labels: Pick<PeopleLabels, "studentLower" | "studentPluralLower">,
  count: number,
): string {
  return pluralizeLabel(
    labels.studentLower,
    labels.studentPluralLower,
    count,
  );
}
