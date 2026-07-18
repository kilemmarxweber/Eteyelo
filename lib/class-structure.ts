import {
  ManagedBranchType,
  normalizeBranchType,
} from "@/lib/academic-structure";
import {
  getBranchTypeLabel as getBranchTypeLabelFromCapabilities,
  isPrimaryBranch as isPrimaryBranchFromCapabilities,
} from "@/lib/branch-capabilities";

/** Primaire : levels internes 1è–6è (name/code = 1è-PR …). */
export const PRIMARY_CLASS_LEVELS = [
  "1è",
  "2è",
  "3è",
  "4è",
  "5è",
  "6è",
] as const;

/** Éducation de Base (CTEB) — option Tronc commun obligatoire. */
export const SECONDARY_CTEB_LEVELS = ["7è", "8è"] as const;

/** Humanités (anc. 3ᵉ–6ᵉ secondaire) — section filière + option obligatoires. */
export const SECONDARY_HUMANITES_LEVELS = ["1è", "2è", "3è", "4è"] as const;

/** Niveaux universitaires (LMD — ESU RDC). */
export const UNIVERSITY_CLASS_LEVELS = [
  "L1",
  "L2",
  "L3",
  "M1",
  "M2",
  "Doctorat",
] as const;

/** Sessions de formation professionnelle. */
export const TRAINING_CLASS_LEVELS = ["Session"] as const;

/** Groupes d'atelier pratique. */
export const WORKSHOP_CLASS_LEVELS = ["Groupe"] as const;

/** @deprecated empty — CTEB uses option Tronc commun, not "without option". */
export const SECONDARY_CLASS_LEVELS_WITHOUT_OPTION = [] as const;

export const SECONDARY_CLASS_LEVELS_WITH_OPTION = [
  ...SECONDARY_CTEB_LEVELS,
  ...SECONDARY_HUMANITES_LEVELS,
] as const;

export const SECONDARY_CLASS_LEVELS = [
  ...SECONDARY_CTEB_LEVELS,
  ...SECONDARY_HUMANITES_LEVELS,
] as const;

export type PrimaryClassLevel = (typeof PRIMARY_CLASS_LEVELS)[number];
export type SecondaryClassLevel = (typeof SECONDARY_CLASS_LEVELS)[number];
export type UniversityClassLevel = (typeof UNIVERSITY_CLASS_LEVELS)[number];
export type TrainingClassLevel = (typeof TRAINING_CLASS_LEVELS)[number];
export type WorkshopClassLevel = (typeof WORKSHOP_CLASS_LEVELS)[number];
export type ClassLevel =
  | PrimaryClassLevel
  | SecondaryClassLevel
  | UniversityClassLevel
  | TrainingClassLevel
  | WorkshopClassLevel;

export function isCtebLevel(level: string): boolean {
  return (SECONDARY_CTEB_LEVELS as readonly string[]).includes(level);
}

export function isHumanitesLevel(level: string): boolean {
  return (SECONDARY_HUMANITES_LEVELS as readonly string[]).includes(level);
}

export function getClassLevelsForBranch(typebranch: unknown): readonly string[] {
  const branchType = normalizeBranchType(typebranch);

  switch (branchType) {
    case "PRIMAIRE":
      return PRIMARY_CLASS_LEVELS;
    case "SECONDAIRE":
      return SECONDARY_CLASS_LEVELS;
    case "UNIVERSITE":
      return UNIVERSITY_CLASS_LEVELS;
    case "CENTRE_FORMATION":
      return TRAINING_CLASS_LEVELS;
    case "ATELIER":
      return WORKSHOP_CLASS_LEVELS;
    default:
      return SECONDARY_CLASS_LEVELS;
  }
}

/** Libellés UI (niveau + aide historique). */
export function getClassLevelLabel(
  typebranch: unknown,
  level: string,
): string {
  const branchType = normalizeBranchType(typebranch);

  if (branchType === "PRIMAIRE") {
    return `${level}-PR`;
  }

  if (branchType === "UNIVERSITE") {
    if (level === "Doctorat") return "Doctorat";
    return level;
  }

  if (branchType === "CENTRE_FORMATION") {
    return "Session de formation";
  }

  if (branchType === "ATELIER") {
    return "Groupe atelier";
  }

  if (isCtebLevel(level)) {
    return `${level} année (Éducation de Base)`;
  }

  const legacy: Record<string, string> = {
    "1è": "3ᵉ secondaire",
    "2è": "4ᵉ secondaire",
    "3è": "5ᵉ secondaire",
    "4è": "6ᵉ secondaire",
  };
  return `${level} Humanités (anc. ${legacy[level] ?? "—"})`;
}

export function requiresOptionForClass(
  typebranch: unknown,
  level: string,
): boolean {
  const branchType = normalizeBranchType(typebranch);

  if (branchType === "SECONDAIRE") {
    return (SECONDARY_CLASS_LEVELS_WITH_OPTION as readonly string[]).includes(
      level,
    );
  }

  if (branchType === "UNIVERSITE" || branchType === "CENTRE_FORMATION") {
    return true;
  }

  return false;
}

export function allowsOptionForBranch(typebranch: unknown): boolean {
  const branchType = normalizeBranchType(typebranch);
  return (
    branchType === "SECONDAIRE" ||
    branchType === "UNIVERSITE" ||
    branchType === "CENTRE_FORMATION"
  );
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
  /** Abréviation catalogue (BIO, MAT, TC…) — prioritaire pour le code. */
  optionAbbrev?: string | null;
};

export function buildClassName(input: BuildClassIdentityInput): string {
  const branchType = normalizeBranchType(input.typebranch);
  const parallel = normalizeParallel(input.parallel);
  const level = input.level.trim();

  if (branchType === "PRIMAIRE") {
    const base = `${level}-PR`;
    return parallel ? `${base} ${parallel}` : base;
  }

  if (branchType === "ATELIER") {
    const base = "Groupe atelier";
    return parallel ? `${base} ${parallel}` : base;
  }

  if (branchType === "CENTRE_FORMATION") {
    const parts = ["Session"];
    if (input.optionName?.trim()) parts.push(input.optionName.trim());
    if (parallel) parts.push(parallel);
    return parts.join(" ");
  }

  const parts: string[] = [level];
  if (parallel) parts.push(parallel);
  if (requiresOptionForClass(branchType, level) && input.optionName?.trim()) {
    parts.push(input.optionName.trim());
  }
  return parts.join(" ");
}

export function buildClassCode(input: BuildClassIdentityInput): string {
  const branchType = normalizeBranchType(input.typebranch);
  const parallel = normalizeParallel(input.parallel);
  const level = input.level.trim();

  if (branchType === "PRIMAIRE") {
    const parts = [`${level}-PR`];
    if (parallel) parts.push(parallel);
    return parts.join("-");
  }

  if (branchType === "ATELIER") {
    const parts = ["ATEL", parallel].filter(Boolean);
    return parts.join("-") || "ATEL";
  }

  if (branchType === "CENTRE_FORMATION") {
    const abbrev =
      input.optionAbbrev?.trim().toUpperCase() ||
      (input.optionName
        ? input.optionName
            .replace(/[^a-zA-Z0-9]/g, "")
            .toUpperCase()
            .slice(0, 4)
        : "SESSION");
    const parts = ["CF", abbrev, parallel].filter(Boolean);
    return parts.join("-") || "CF-SESSION";
  }

  const abbrev =
    input.optionAbbrev?.trim().toUpperCase() ||
    (input.optionName
      ? input.optionName
          .replace(/[^a-zA-Z0-9]/g, "")
          .toUpperCase()
          .slice(0, 3)
      : "");

  const parts = [level, parallel, abbrev].filter(Boolean);
  return parts.join("-") || "CLS";
}

export function validateClassInput(params: {
  typebranch: unknown;
  level?: string | null;
  parallel?: string | null;
  optionId?: string | null;
  nameClasse?: string | null;
  isLegacy?: boolean;
}): {
  level?: string;
  parallel?: string;
  optionId?: string;
  nameClasse?: string;
} {
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

    if (branchType === "ATELIER" && params.optionId) {
      throw new Error(
        "Les groupes d'atelier ne peuvent pas avoir d'option",
      );
    }

    return {
      nameClasse,
      optionId:
        branchType === "PRIMAIRE" || branchType === "ATELIER"
          ? undefined
          : params.optionId ?? undefined,
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

  if (branchType === "ATELIER" && params.optionId) {
    throw new Error("Les groupes d'atelier ne peuvent pas avoir d'option");
  }

  if (requiresOptionForClass(branchType, level) && !params.optionId) {
    throw new Error("Une option est requise pour ce niveau");
  }

  const parallel = normalizeParallel(params.parallel);
  if (parallel && !/^[A-Z0-9]{1,3}$/.test(parallel)) {
    throw new Error(
      "Le parallele doit contenir 1 a 3 caracteres alphanumeriques",
    );
  }

  return {
    level,
    parallel,
    optionId: params.optionId ?? undefined,
  };
}

export function isPrimaryBranch(typebranch: unknown): boolean {
  return isPrimaryBranchFromCapabilities(typebranch);
}

export function assertSecondaryBranchFeatures(typebranch: unknown) {
  if (isPrimaryBranch(typebranch)) {
    throw new Error(
      "Cette fonctionnalite n'est pas disponible pour une branche primaire",
    );
  }
}

export function getBranchTypeLabel(typebranch: unknown): string {
  return getBranchTypeLabelFromCapabilities(typebranch);
}

export type BranchType = ManagedBranchType;
