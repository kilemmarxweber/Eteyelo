import {
  type ManagedBranchType,
  normalizeBranchType,
} from "@/lib/academic-structure";
import { getBranchTypeLabel } from "@/lib/branch-capabilities";
import { getTrainingLabels } from "@/lib/training-labels";

/** Types proposés sur l'inscription publique (hors atelier). */
export const PUBLIC_REGISTRATION_BRANCH_TYPES = [
  "PRIMAIRE",
  "SECONDAIRE",
  "CENTRE_FORMATION",
  "UNIVERSITE",
] as const satisfies readonly ManagedBranchType[];

export type PublicRegistrationBranchType =
  (typeof PUBLIC_REGISTRATION_BRANCH_TYPES)[number];

export function isPublicRegistrationBranchType(
  value: unknown,
): value is PublicRegistrationBranchType {
  return (
    typeof value === "string" &&
    (PUBLIC_REGISTRATION_BRANCH_TYPES as readonly string[]).includes(value)
  );
}

/** Libellé singulier du sélecteur d'établissement (École, Centre, Université…). */
export function getEstablishmentPickerLabel(typebranch: unknown): string {
  const type = normalizeBranchType(typebranch) as ManagedBranchType;

  switch (type) {
    case "CENTRE_FORMATION":
      return "Centre de formation";
    case "UNIVERSITE":
      return "Université";
    case "PRIMAIRE":
    case "SECONDAIRE":
      return "École";
    default:
      return "Établissement";
  }
}

export function getEstablishmentTypeFilterLabel(typebranch: unknown): string {
  return getBranchTypeLabel(typebranch);
}

export function usesBranchAcademicTree(typebranch: unknown): boolean {
  const type = normalizeBranchType(typebranch);
  return type === "CENTRE_FORMATION" || type === "UNIVERSITE";
}

export function getPublicLevelFieldLabels(typebranch: unknown) {
  const type = normalizeBranchType(typebranch) as ManagedBranchType;
  const training = getTrainingLabels(type);

  if (type === "CENTRE_FORMATION") {
    return {
      level: "Session",
      section: training.sectionBadge,
      option: training.optionBadge,
    };
  }

  if (type === "UNIVERSITE") {
    return {
      level: "Niveau",
      section: training.sectionBadge,
      option: training.optionBadge,
    };
  }

  if (type === "SECONDAIRE") {
    return {
      level: "Niveau",
      section: "Section (filière)",
      option: "Option",
    };
  }

  return {
    level: "Niveau",
    section: "Section",
    option: "Option",
  };
}
