"use client";

import { useSession } from "@/lib/auth-client";
import { isUniversiteBranch } from "@/lib/branch-capabilities";
import { getPeopleLabels } from "@/lib/people-labels";
import { UNIVERSITY_NOTES_LABELS } from "@/lib/university-lmd-labels";

export function useNotesLabels(typebranchOverride?: unknown) {
  const { data: session } = useSession();
  const typebranch = typebranchOverride ?? session?.branch?.typebranch;
  const isUniversite = isUniversiteBranch(typebranch);
  const peopleLabels = getPeopleLabels(typebranch);

  return {
    typebranch,
    isUniversite,
    sessionLabel: isUniversite ? UNIVERSITY_NOTES_LABELS.session : "Période",
    sessionPlaceholder: isUniversite
      ? UNIVERSITY_NOTES_LABELS.sessionPlaceholder
      : "Sélectionner une période",
    courseContextLabel: isUniversite
      ? UNIVERSITY_NOTES_LABELS.courseAuditoire
      : "Cours et classe",
    coursesListTitle: isUniversite
      ? UNIVERSITY_NOTES_LABELS.coursesAndAuditoires
      : "Cours et classes",
    classColumnLabel: isUniversite
      ? UNIVERSITY_NOTES_LABELS.auditoire
      : "Classe",
    subjectColumnLabel: isUniversite ? UNIVERSITY_NOTES_LABELS.course : "Matière",
    studentPlural: peopleLabels.studentPluralLower,
    studentSingular: peopleLabels.studentLower,
    teacher: peopleLabels.teacher,
    teacherLower: peopleLabels.teacherLower,
    exportClassLabel: isUniversite ? "Auditoire:" : "Classe:",
    exportSessionLabel: isUniversite ? "Session:" : "Période:",
    undefinedClassLabel: isUniversite
      ? UNIVERSITY_NOTES_LABELS.auditoireUndefined
      : "Classe non définie",
  };
}
