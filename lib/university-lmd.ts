import { getAcademicStructure } from "@/lib/academic-structure";
import { isUniversiteBranch } from "@/lib/branch-capabilities";
import {
  UNIVERSITY_LMD_CALENDAR_OUTLINE,
  UNIVERSITY_LMD_LABELS,
} from "@/lib/university-lmd-labels";

/** Niveaux LMD reconnus pour la numérotation globale des semestres (S1–S16). */
export const LMD_LEVELS = [
  "L1",
  "L2",
  "L3",
  "M1",
  "M2",
  "Doctorat",
] as const;

export type LmdLevel = (typeof LMD_LEVELS)[number];

/** Index du premier semestre global pour chaque niveau (L1 → S1, L2 → S3, …). */
const LMD_LEVEL_SEMESTER_OFFSET: Record<LmdLevel, number> = {
  L1: 0,
  L2: 2,
  L3: 4,
  M1: 6,
  M2: 8,
  Doctorat: 10,
};

export const LMD_LEVEL_LABELS: Record<LmdLevel, string> = {
  L1: "Licence 1",
  L2: "Licence 2",
  L3: "Licence 3",
  M1: "Master 1",
  M2: "Master 2",
  Doctorat: "Doctorat",
};

export type SemesterInYear = 1 | 2;

export function isLmdLevel(level: unknown): level is LmdLevel {
  return (
    typeof level === "string" &&
    (LMD_LEVELS as readonly string[]).includes(level)
  );
}

/** Numéro global LMD (1–16) à partir du niveau auditoire et du semestre dans l'année. */
export function getGlobalSemesterNumber(
  level: unknown,
  semesterInYear: SemesterInYear,
): number | null {
  if (!isLmdLevel(level)) return null;
  return LMD_LEVEL_SEMESTER_OFFSET[level] + semesterInYear;
}

/** Code affiché : S1, S2, … S16. */
export function formatGlobalSemesterCode(
  level: unknown,
  semesterInYear: SemesterInYear,
): string {
  const globalNumber = getGlobalSemesterNumber(level, semesterInYear);
  return globalNumber ? `S${globalNumber}` : `S${semesterInYear}`;
}

/** Libellé complet : « Premier semestre (S5) » pour un auditoire L3. */
export function formatUniversitySemesterLabel(
  semesterInYear: SemesterInYear,
  level?: unknown,
): string {
  const base =
    semesterInYear === 1
      ? UNIVERSITY_LMD_LABELS.firstSemester
      : UNIVERSITY_LMD_LABELS.secondSemester;

  if (!level || !isLmdLevel(level)) {
    return base;
  }

  return `${base} (${formatGlobalSemesterCode(level, semesterInYear)})`;
}

/** Options de filtre relevé (semestre dans l'année académique). */
export function getUniversitySemesterFilterOptions(level?: unknown) {
  return [
    { value: "all", label: "Relevé annuel" },
    {
      value: "1",
      label: formatUniversitySemesterLabel(1, level),
    },
    {
      value: "2",
      label: formatUniversitySemesterLabel(2, level),
    },
  ] as const;
}

export const UNIVERSITY_LMD_TERMS = {
  academicYear: UNIVERSITY_LMD_LABELS.academicYear,
  academicYearPlural: UNIVERSITY_LMD_LABELS.academicYearPlural,
  firstSemester: UNIVERSITY_LMD_LABELS.firstSemester,
  secondSemester: UNIVERSITY_LMD_LABELS.secondSemester,
  courses: UNIVERSITY_LMD_LABELS.courses,
  evaluations: UNIVERSITY_LMD_LABELS.evaluations,
  firstSession: UNIVERSITY_LMD_LABELS.firstSession,
  secondSession: UNIVERSITY_LMD_LABELS.secondSession,
  deliberations: UNIVERSITY_LMD_LABELS.deliberations,
  defense: UNIVERSITY_LMD_LABELS.defense,
} as const;

const DEFAULT_SCHOOL_YEAR_LABEL = "Année scolaire";
const DEFAULT_SCHOOL_YEAR_LABEL_PLURAL = "Années scolaires";

/** Libellé « Année scolaire » ou « Année académique » selon le type de branche. */
export function getSchoolYearDisplayLabel(typebranch?: unknown): string {
  return isUniversiteBranch(typebranch)
    ? UNIVERSITY_LMD_TERMS.academicYear
    : DEFAULT_SCHOOL_YEAR_LABEL;
}

export function getSchoolYearDisplayLabelPlural(typebranch?: unknown): string {
  return isUniversiteBranch(typebranch)
    ? UNIVERSITY_LMD_TERMS.academicYearPlural
    : DEFAULT_SCHOOL_YEAR_LABEL_PLURAL;
}

export function getSchoolYearDisplayLabelLower(typebranch?: unknown): string {
  return getSchoolYearDisplayLabel(typebranch).toLowerCase();
}

/** Groupes calendrier LMD pour une branche université. */
export function getUniversityLmdGroups() {
  return getAcademicStructure("UNIVERSITE").groups;
}

/** Periodes LMD d'un semestre (1 ou 2 dans l'annee academique). */
export function getUniversityLmdPeriodsForSemester(semesterInYear: SemesterInYear) {
  const group = getUniversityLmdGroups().find((item) => item.order === semesterInYear);
  return group?.periods ?? [];
}

/** Arborescence calendrier ESU pour affichage aide / documentation. */
export function getUniversityLmdCalendarOutline() {
  return UNIVERSITY_LMD_CALENDAR_OUTLINE;
}

export { UNIVERSITY_LMD_LABELS, UNIVERSITY_LMD_CALENDAR_OUTLINE };

/** Tableau LMD : niveau → semestres globaux (S1–S16). */
export const LMD_SEMESTER_MATRIX: Array<{
  level: LmdLevel;
  label: string;
  semesters: string[];
}> = [
  { level: "L1", label: "Licence 1", semesters: ["S1", "S2"] },
  { level: "L2", label: "Licence 2", semesters: ["S3", "S4"] },
  { level: "L3", label: "Licence 3", semesters: ["S5", "S6"] },
  { level: "M1", label: "Master 1", semesters: ["S7", "S8"] },
  { level: "M2", label: "Master 2", semesters: ["S9", "S10"] },
  {
    level: "Doctorat",
    label: "Doctorat",
    semesters: ["S11", "S12", "S13", "S14", "S15", "S16"],
  },
];
