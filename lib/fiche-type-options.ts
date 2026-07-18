import { isUniversiteBranch } from "@/lib/branch-capabilities";

/** Types intermediaires (hors fiche de cotation) pour primaire/secondaire. */
export const SCHOOL_INTERMEDIATE_FICHE_TYPES = [
  "Devoir",
  "Evaluation",
  "TP",
] as const;

/** Types intermediaires pour universite — pas de devoir. */
export const UNIVERSITY_INTERMEDIATE_FICHE_TYPES = [
  "Evaluation",
  "TP",
  "TFC",
  "Memoire",
] as const;

export type IntermediateFicheType =
  | (typeof SCHOOL_INTERMEDIATE_FICHE_TYPES)[number]
  | (typeof UNIVERSITY_INTERMEDIATE_FICHE_TYPES)[number];

export type FicheTypeOptionValue = IntermediateFicheType | "ficheCote";

export function getIntermediateFicheTypes(
  typebranch: unknown,
): readonly IntermediateFicheType[] {
  return isUniversiteBranch(typebranch)
    ? UNIVERSITY_INTERMEDIATE_FICHE_TYPES
    : SCHOOL_INTERMEDIATE_FICHE_TYPES;
}

/** Types notes sur /10 (devoir, evaluation, TP selon branche). */
export function isStandardFicheType(
  typeFiche: string | null | undefined,
  typebranch: unknown,
): boolean {
  if (!typeFiche) return false;
  return (getIntermediateFicheTypes(typebranch) as readonly string[]).includes(
    typeFiche,
  );
}

export function isAllowedFicheType(
  typeFiche: string,
  typebranch: unknown,
  options?: { isAdmin?: boolean; isExam?: boolean },
): boolean {
  const { isAdmin = false, isExam = false } = options ?? {};

  if (isExam && !isUniversiteBranch(typebranch)) {
    return isAdmin && typeFiche === "ficheCote";
  }

  if (typeFiche === "ficheCote") {
    return isAdmin;
  }

  return (getIntermediateFicheTypes(typebranch) as readonly string[]).includes(
    typeFiche,
  );
}

export function getFicheTypeComboboxItems(params: {
  typebranch: unknown;
  isAdmin: boolean;
  isExam: boolean;
}): Array<{ value: FicheTypeOptionValue; label: string }> {
  const { typebranch, isAdmin, isExam } = params;

  if (isExam && !isUniversiteBranch(typebranch)) {
    return isAdmin ? [{ value: "ficheCote", label: "Fiche" }] : [];
  }

  const intermediate = getIntermediateFicheTypes(typebranch).map((value) => ({
    value,
    label: value,
  }));

  if (isAdmin) {
    return [...intermediate, { value: "ficheCote", label: "Fiche" }];
  }

  return intermediate;
}

/** Libelles du recapitulatif resultats par type de fiche. */
export function getResultSummaryTypeLabels(typebranch: unknown): string[] {
  if (isUniversiteBranch(typebranch)) {
    return [...UNIVERSITY_INTERMEDIATE_FICHE_TYPES];
  }

  return [
    "TP",
    "Projets",
    "Tests Standardisés",
    "Assignments",
    "Devoir",
    "Veilles",
    "Evaluation",
    "Discipline",
    "Rétrospectives",
  ];
}
