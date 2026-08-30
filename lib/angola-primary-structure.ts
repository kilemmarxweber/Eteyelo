import { normalizeEducationSystem } from "@/lib/education-system";

/** Section unique du 1.º ciclo primário (1ª–4ª). */
export const ANGOLA_PRIMARY_SECTION_CODE = "PRIMARIO";
export const ANGOLA_PRIMARY_SECTION_NAME = "Ensino Primário";
export const ANGOLA_PRIMARY_OPTION_CODE = "GERAL";
export const ANGOLA_PRIMARY_OPTION_NAME = "Geral";

/** Ensino Primário angolais : 1ª à 6ª classe. */
export const ANGOLA_PRIMARY_LEVELS = [
  "1ª",
  "2ª",
  "3ª",
  "4ª",
  "5ª",
  "6ª",
] as const;

/** 1.º Ciclo do Ensino Primário : 1ª–4ª. */
export const ANGOLA_PRIMARY_FIRST_CYCLE_LEVELS = [
  "1ª",
  "2ª",
  "3ª",
  "4ª",
] as const;

export type AngolaPrimaryLevel = (typeof ANGOLA_PRIMARY_LEVELS)[number];
export type AngolaPrimaryFirstCycleLevel =
  (typeof ANGOLA_PRIMARY_FIRST_CYCLE_LEVELS)[number];

const ANGOLA_PRIMARY_LABELS: Record<AngolaPrimaryLevel, string> = {
  "1ª": "1ª (Primeira Classe)",
  "2ª": "2ª (Segunda Classe)",
  "3ª": "3ª (Terceira Classe)",
  "4ª": "4ª (Quarta Classe)",
  "5ª": "5ª (Quinta Classe)",
  "6ª": "6ª (Sexta Classe)",
};

const ANGOLA_PRIMARY_ALIASES: Record<string, AngolaPrimaryLevel> = {
  "1ª": "1ª",
  "1a": "1ª",
  "1è": "1ª",
  "1e": "1ª",
  "2ª": "2ª",
  "2a": "2ª",
  "2è": "2ª",
  "2e": "2ª",
  "3ª": "3ª",
  "3a": "3ª",
  "3è": "3ª",
  "3e": "3ª",
  "4ª": "4ª",
  "4a": "4ª",
  "4è": "4ª",
  "4e": "4ª",
  "5ª": "5ª",
  "5a": "5ª",
  "5è": "5ª",
  "5e": "5ª",
  "6ª": "6ª",
  "6a": "6ª",
  "6è": "6ª",
  "6e": "6ª",
};

export function isAngolaPrimarySystem(
  typebranch: unknown,
  educationSystem?: unknown,
): boolean {
  return (
    typebranch === "PRIMAIRE" &&
    normalizeEducationSystem(educationSystem) === "ANGOLAIS"
  );
}

export function normalizeAngolaPrimaryLevel(
  level: string | null | undefined,
): AngolaPrimaryLevel | null {
  if (!level) return null;
  return ANGOLA_PRIMARY_ALIASES[level.trim()] ?? null;
}

export function isAngolaPrimaryLevel(
  level: string | null | undefined,
): level is AngolaPrimaryLevel {
  return normalizeAngolaPrimaryLevel(level) !== null;
}

export function angolaPrimaryLevelLabel(level: string): string {
  const normalized = normalizeAngolaPrimaryLevel(level);
  if (!normalized) return level;
  return ANGOLA_PRIMARY_LABELS[normalized];
}

export function extractAngolaPrimaryLevelFromLabel(
  value?: string | null,
): AngolaPrimaryLevel | null {
  if (!value) return null;
  const direct = normalizeAngolaPrimaryLevel(value);
  if (direct) return direct;
  const match = value.match(/\b([1-6])\s*[ªaàèe]/i);
  if (!match) return null;
  return normalizeAngolaPrimaryLevel(`${match[1]}ª`);
}

export function isAngolaPrimaryFirstCycleLevel(
  level: string | null | undefined,
): boolean {
  const normalized =
    extractAngolaPrimaryLevelFromLabel(level) ??
    normalizeAngolaPrimaryLevel(level);
  return (
    !!normalized &&
    (ANGOLA_PRIMARY_FIRST_CYCLE_LEVELS as readonly string[]).includes(
      normalized,
    )
  );
}

export function shouldUseAngolaPrimaryStudyDeclaration(
  educationSystem: unknown,
  branchType?: unknown,
  classLevel?: string | null,
  classLabel?: string | null,
): boolean {
  if (normalizeEducationSystem(educationSystem) !== "ANGOLAIS") return false;
  if (
    isAngolaPrimaryFirstCycleLevel(classLevel) ||
    isAngolaPrimaryFirstCycleLevel(classLabel)
  ) {
    return true;
  }
  const extracted =
    extractAngolaPrimaryLevelFromLabel(classLevel) ??
    extractAngolaPrimaryLevelFromLabel(classLabel);
  if (extracted) return isAngolaPrimaryFirstCycleLevel(extracted);
  return branchType === "PRIMAIRE";
}

export function isAngolaPrimaryOption(option: {
  codeOption?: string | null;
  nameOption?: string | null;
}): boolean {
  const code = option.codeOption?.toUpperCase();
  const name = option.nameOption
    ?.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return code === ANGOLA_PRIMARY_OPTION_CODE || name === "geral";
}

/** Relie 1ª → 1è pour la pondération primaire déjà en place. */
export function angolaPrimaryToDrcLevel(
  level: string | null | undefined,
): "1è" | "2è" | "3è" | "4è" | "5è" | "6è" | null {
  const normalized = normalizeAngolaPrimaryLevel(level);
  if (!normalized) return null;
  const mapped = `${normalized.replace("ª", "")}è` as
    | "1è"
    | "2è"
    | "3è"
    | "4è"
    | "5è"
    | "6è";
  return mapped;
}
