import {
  type ManagedBranchType,
  normalizeBranchType,
} from "@/lib/academic-structure";
import { getBranchTypeLabel } from "@/lib/branch-capabilities";
import {
  cycleLabel,
  getBranchCycles,
  isSchoolCycle,
  type BranchCycleInput,
  type Cycle,
} from "@/lib/cycle";
import { getTrainingLabels } from "@/lib/training-labels";

/** Cycles / types proposés sur l'inscription et la candidature publiques (hors atelier). */
export const PUBLIC_REGISTRATION_BRANCH_TYPES = [
  "MATERNELLE",
  "PRIMAIRE",
  "SECONDAIRE",
  "CENTRE_FORMATION",
  "UNIVERSITE",
] as const;

export type PublicRegistrationBranchType =
  (typeof PUBLIC_REGISTRATION_BRANCH_TYPES)[number];

export type PublicBranchForFilter = {
  typebranch?: unknown;
  cycles?: BranchCycleInput[] | null;
};

export function isPublicRegistrationBranchType(
  value: unknown,
): value is PublicRegistrationBranchType {
  return (
    typeof value === "string" &&
    (PUBLIC_REGISTRATION_BRANCH_TYPES as readonly string[]).includes(value)
  );
}

export function getPublicBranchCycles(branch: PublicBranchForFilter): Cycle[] {
  return getBranchCycles(branch);
}

/** Une école multi-cycle apparaît pour chaque cycle qu'elle couvre. */
export function branchMatchesPublicType(
  branch: PublicBranchForFilter,
  filter: PublicRegistrationBranchType,
): boolean {
  return getPublicBranchCycles(branch).includes(filter as Cycle);
}

export function listAvailablePublicBranchTypes(
  branches: PublicBranchForFilter[],
): PublicRegistrationBranchType[] {
  return PUBLIC_REGISTRATION_BRANCH_TYPES.filter((type) =>
    branches.some((branch) => branchMatchesPublicType(branch, type)),
  );
}

export function formatPublicBranchSelectLabel(
  branch: {
    name: string;
    ville?: string | null;
    pays?: string | null;
  } & PublicBranchForFilter,
  options?: { includeLocation?: boolean },
): string {
  const location = branch.ville?.trim() || branch.pays?.trim() || "";
  const schoolCycles = getPublicBranchCycles(branch).filter(isSchoolCycle);
  const cyclePart =
    schoolCycles.length > 1
      ? ` · ${schoolCycles.map((cycle) => cycleLabel(cycle)).join(", ")}`
      : "";
  if (options?.includeLocation === false) {
    return `${branch.name}${cyclePart}`;
  }
  return location
    ? `${branch.name} · ${location}${cyclePart}`
    : `${branch.name}${cyclePart}`;
}

/** Libellé singulier du sélecteur d'établissement (École, Centre, Université…). */
export function getEstablishmentPickerLabel(typebranch: unknown): string {
  if (typebranch === "MATERNELLE") return "École";
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
  if (typebranch === "MATERNELLE") {
    return {
      level: "Classe",
      section: "Section",
      option: "Option",
    };
  }

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

  if (type === "PRIMAIRE") {
    return {
      level: "Classe",
      section: "Section",
      option: "Option",
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
