/**
 * Appellations officielles du calendrier LMD (ESU RDC) — reservees a UNIVERSITE.
 * Fichier sans dependance pour eviter les imports circulaires.
 */
export const UNIVERSITY_LMD_LABELS = {
  academicYear: "Année académique",
  academicYearPlural: "Années académiques",
  firstSemester: "Premier semestre",
  secondSemester: "Deuxième semestre",
  courses: "Cours",
  evaluations: "Évaluations",
  firstSession: "Première session",
  secondSession: "Deuxième session",
  /** Alias historiques — periodes retirees du calendrier actif. */
  deliberations: "Délibérations",
  defense: "Défense de TFC ou de mémoire (pour les finalistes)",
} as const;

/** Libellés UI saisie des notes (universite). */
export const UNIVERSITY_NOTES_LABELS = {
  session: "Session",
  sessionPlaceholder: "Sélectionner une session",
  courseAuditoire: "Cours · Auditoire",
  coursesAndAuditoires: "Cours et auditoires",
  auditoire: "Auditoire",
  course: "Cours",
  auditoireUndefined: "Auditoire non défini",
} as const;

export const UNIVERSITY_LMD_CALENDAR_OUTLINE = [
  {
    semester: UNIVERSITY_LMD_LABELS.firstSemester,
    periods: [
      UNIVERSITY_LMD_LABELS.courses,
      UNIVERSITY_LMD_LABELS.evaluations,
      UNIVERSITY_LMD_LABELS.firstSession,
    ],
  },
  {
    semester: UNIVERSITY_LMD_LABELS.secondSemester,
    periods: [
      UNIVERSITY_LMD_LABELS.courses,
      UNIVERSITY_LMD_LABELS.evaluations,
      UNIVERSITY_LMD_LABELS.secondSession,
    ],
  },
] as const;
