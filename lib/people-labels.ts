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
  /** l'élève / l'apprenant / l'étudiant */
  studentDefinite: string;
  /** un élève / un apprenant / un étudiant */
  studentIndefinite: string;
  /** Nouvel élève / Nouvel apprenant / Nouvel étudiant */
  studentNew: string;
  /** Ancien élève / Ancien apprenant / Ancien étudiant */
  studentExisting: string;
  /** Matricule élève (automatique) */
  matriculeAutoLabel: string;
  /** Email élève (automatique) */
  emailAutoLabel: string;
  /** Photo élève (facultatif) */
  photoOptionalLabel: string;
  /** Aperçu photo élève */
  photoPreviewAlt: string;
  /** Modifier l'élève */
  editTitle: string;
  /** Ajustez les informations de l'élève… */
  editDescription: string;
  /** Enregistrer l'élève */
  saveLabel: string;
  /** Mettre à jour l'élève */
  updateLabel: string;
  /** Le nom de l'élève */
  namePlaceholder: string;
  /** Le postnom de l'élève */
  postnomPlaceholder: string;
  /** Le prénom de l'élève */
  prenomPlaceholder: string;
  /** Adresse de l'élève */
  addressPlaceholder: string;
  /** chercher un élève… */
  searchPlaceholder: string;
  /** Rechercher un élève */
  searchLabel: string;
  /** Aucun élève */
  noneLabel: string;
  /** Aucun élève inscrit */
  noneEnrolledTitle: string;
  /** Aucun élève n'est actuellement inscrit… */
  noneEnrolledDescription: string;
  /** Gérer les inscriptions des élèves */
  enrollmentsPageTitle: string;
  /** Details de l'élève */
  detailsTitle: string;
  /** Archiver l'élève ? */
  archiveTitle: string;
  /** L'élève sera masqué… */
  archiveDescriptionSingular: string;
  /** Ces élèves seront masqués… */
  archiveDescriptionPlural: string;
  /** Matricule (sans suffixe) */
  matriculeLabel: string;
};

type PeopleLabelBase = Pick<
  PeopleLabels,
  "student" | "studentPlural" | "teacher" | "teacherPlural"
>;

function buildPeopleLabels(base: PeopleLabelBase): PeopleLabels {
  const studentLower = base.student.toLowerCase();
  const studentPluralLower = base.studentPlural.toLowerCase();
  const teacherLower = base.teacher.toLowerCase();
  const teacherPluralLower = base.teacherPlural.toLowerCase();
  const studentDefinite = `l'${studentLower}`;

  return {
    student: base.student,
    studentPlural: base.studentPlural,
    studentLower,
    studentPluralLower,
    teacher: base.teacher,
    teacherPlural: base.teacherPlural,
    teacherLower,
    teacherPluralLower,
    studentDefinite,
    studentIndefinite: `un ${studentLower}`,
    studentNew: `Nouvel ${studentLower}`,
    studentExisting: `Ancien ${studentLower}`,
    matriculeLabel: `Matricule ${studentLower}`,
    matriculeAutoLabel: `Matricule ${studentLower} (automatique)`,
    emailAutoLabel: `Email ${studentLower} (automatique)`,
    photoOptionalLabel: `Photo ${studentLower} (facultatif)`,
    photoPreviewAlt: `Aperçu photo ${studentLower}`,
    editTitle: `Modifier ${studentDefinite}`,
    editDescription: `Ajustez les informations de ${studentDefinite}, puis enregistrez.`,
    saveLabel: `Enregistrer ${studentDefinite}`,
    updateLabel: `Mettre à jour ${studentDefinite}`,
    namePlaceholder: `Le nom de ${studentDefinite}`,
    postnomPlaceholder: `Le postnom de ${studentDefinite}`,
    prenomPlaceholder: `Le prénom de ${studentDefinite}`,
    addressPlaceholder: `Adresse de ${studentDefinite}`,
    searchPlaceholder: `chercher un ${studentLower}...`,
    searchLabel: `Rechercher un ${studentLower}`,
    noneLabel: `Aucun ${studentLower}`,
    noneEnrolledTitle: `Aucun ${studentLower} inscrit`,
    noneEnrolledDescription: `Aucun ${studentLower} n'est actuellement inscrit dans cette classe.`,
    enrollmentsPageTitle: `Gérer les inscriptions des ${studentPluralLower}`,
    detailsTitle: `Details de ${studentDefinite}`,
    archiveTitle: `Archiver ${studentDefinite} ?`,
    archiveDescriptionSingular: `L'${studentLower} sera masqué des listes actives mais l'historique sera conservé.`,
    archiveDescriptionPlural: `Ces ${studentPluralLower} seront masqués des listes actives mais l'historique sera conservé.`,
  };
}

const SCHOOL_LABELS = buildPeopleLabels({
  student: "Élève",
  studentPlural: "Élèves",
  teacher: "Enseignant",
  teacherPlural: "Enseignants",
});

/** Libellés par defaut (primaire, secondaire, atelier). */
export const DEFAULT_PEOPLE_LABELS: PeopleLabels = SCHOOL_LABELS;

const TRAINING_LABELS = buildPeopleLabels({
  student: "Apprenant",
  studentPlural: "Apprenants",
  teacher: "Enseignant",
  teacherPlural: "Enseignants",
});

const UNIVERSITY_LABELS = buildPeopleLabels({
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
