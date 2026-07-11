import {
  ManagedBranchType,
  normalizeBranchType,
} from "@/lib/academic-structure";

export const PRIMARY_CLASS_LEVELS = [
  "1er",
  "2e",
  "3e",
  "4e",
  "5e",
  "6e",
] as const;

export const SECONDARY_CLASS_LEVELS_WITHOUT_OPTION = ["7e", "8e"] as const;

export const SECONDARY_CLASS_LEVELS_WITH_OPTION = [
  "1er",
  "2e",
  "3e",
  "4e",
] as const;

export const SECONDARY_CLASS_LEVELS = [
  ...SECONDARY_CLASS_LEVELS_WITHOUT_OPTION,
  ...SECONDARY_CLASS_LEVELS_WITH_OPTION,
] as const;

export type PrimaryClassLevel = (typeof PRIMARY_CLASS_LEVELS)[number];
export type SecondaryClassLevel = (typeof SECONDARY_CLASS_LEVELS)[number];
export type ClassLevel = PrimaryClassLevel | SecondaryClassLevel;

export function getClassLevelsForBranch(typebranch: unknown): readonly string[] {
  return normalizeBranchType(typebranch) === "PRIMAIRE"
    ? PRIMARY_CLASS_LEVELS
    : SECONDARY_CLASS_LEVELS;
}

export function requiresOptionForClass(
  typebranch: unknown,
  level: string,
): boolean {
  return (
    normalizeBranchType(typebranch) === "SECONDAIRE" &&
    (SECONDARY_CLASS_LEVELS_WITH_OPTION as readonly string[]).includes(level)
  );
}

export function allowsOptionForBranch(typebranch: unknown): boolean {
  return normalizeBranchType(typebranch) === "SECONDAIRE";
}

export function isValidClassLevel(
  typebranch: unknown,
  level: string,
): boolean {
  return getClassLevelsForBranch(typebranch).includes(level);
}

export function normalizeParallel(value?: string | null): string | undefined {
  const parallel = value?.trim().toUpperCase();
  return parallel || undefined;
}

export type BuildClassIdentityInput = {
  typebranch: unknown;
  level: string;
  parallel?: string | null;
  optionName?: string | null;
};

export function buildClassName(input: BuildClassIdentityInput): string {
  const parts: string[] = [input.level.trim()];

  const parallel = normalizeParallel(input.parallel);
  if (parallel) {
    parts.push(parallel);
  }

  if (
    requiresOptionForClass(input.typebranch, input.level) &&
    input.optionName?.trim()
  ) {
    parts.push(input.optionName.trim());
  }

  return parts.join(" ");
}

export function buildClassCode(input: BuildClassIdentityInput): string {
  const levelCode = input.level
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 3);
  const parallelCode = normalizeParallel(input.parallel) ?? "";
  const optionCode = input.optionName
    ? input.optionName
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .slice(0, 3)
    : "";

  const parts = [levelCode, parallelCode, optionCode].filter(Boolean);
  return parts.join("-") || "CLS";
}

export function validateClassInput(params: {
  typebranch: unknown;
  level?: string | null;
  parallel?: string | null;
  optionId?: string | null;
  nameClasse?: string | null;
  isLegacy?: boolean;
}): { level?: string; parallel?: string; optionId?: string; nameClasse?: string } {
  const branchType = normalizeBranchType(params.typebranch);

  if (params.isLegacy) {
    const nameClasse = params.nameClasse?.trim();
    if (!nameClasse || nameClasse.length < 5) {
      throw new Error(
        "Le nom de la classe doit avoir au moins 5 caracteres",
      );
    }

    if (branchType === "PRIMAIRE" && params.optionId) {
      throw new Error(
        "Les classes primaires ne peuvent pas avoir d'option",
      );
    }

    return {
      nameClasse,
      optionId: branchType === "PRIMAIRE" ? undefined : params.optionId ?? undefined,
    };
  }

  const level = params.level?.trim();
  if (!level) {
    throw new Error("Veuillez selectionner un niveau");
  }

  if (!isValidClassLevel(branchType, level)) {
    throw new Error("Niveau de classe invalide pour cette branche");
  }

  if (branchType === "PRIMAIRE" && params.optionId) {
    throw new Error("Les classes primaires ne peuvent pas avoir d'option");
  }

  if (requiresOptionForClass(branchType, level) && !params.optionId) {
    throw new Error("Une option est requise pour ce niveau");
  }

  if (
    branchType === "SECONDAIRE" &&
    (SECONDARY_CLASS_LEVELS_WITHOUT_OPTION as readonly string[]).includes(
      level,
    ) &&
    params.optionId
  ) {
    throw new Error("Les niveaux 7e et 8e ne peuvent pas avoir d'option");
  }

  const parallel = normalizeParallel(params.parallel);
  if (parallel && !/^[A-Z0-9]{1,3}$/.test(parallel)) {
    throw new Error("Le parallele doit contenir 1 a 3 caracteres alphanumeriques");
  }

  return {
    level,
    parallel,
    optionId: params.optionId ?? undefined,
  };
}

export function isPrimaryBranch(typebranch: unknown): boolean {
  return normalizeBranchType(typebranch) === "PRIMAIRE";
}

export function assertSecondaryBranchFeatures(typebranch: unknown) {
  if (isPrimaryBranch(typebranch)) {
    throw new Error(
      "Cette fonctionnalite n'est pas disponible pour une branche primaire",
    );
  }
}

export function getBranchTypeLabel(typebranch: unknown): string {
  return normalizeBranchType(typebranch) === "PRIMAIRE"
    ? "Primaire"
    : "Secondaire";
}

export type BranchType = ManagedBranchType;
