import { normalizeEducationSystem } from "@/lib/education-system";

/**
 * Ensino secundário angolais — 2 ciclos.
 *
 * 1.º Ciclo (7ª–8ª) : núcleo comum, comme le tronc commun — pas de choix d'option.
 * 2.º Ciclo (9ª–12ª + 13ª) : section et option obligatoires (défaut Técnica / Electricidade).
 */

export const ANGOLA_FIRST_CYCLE_LEVELS = ["7ª", "8ª"] as const;
export const ANGOLA_SECOND_CYCLE_LEVELS = ["9ª", "10ª", "11ª", "12ª"] as const;
export const ANGOLA_REDUCED_LEVEL = "13ª";

export const ANGOLA_SECONDARY_LEVELS = [
  ...ANGOLA_FIRST_CYCLE_LEVELS,
  ...ANGOLA_SECOND_CYCLE_LEVELS,
  ANGOLA_REDUCED_LEVEL,
] as const;

export type AngolaSecondaryLevel = (typeof ANGOLA_SECONDARY_LEVELS)[number];
export type AngolaSecondaryCycle = "CICLO1" | "CICLO2";
export type AngolaHoraireType = "COMPLET" | "REDUIT";

const ANGOLA_LEVEL_ALIASES: Record<string, AngolaSecondaryLevel> = {
  "7ª": "7ª",
  "7a": "7ª",
  "7è": "7ª",
  "7e": "7ª",
  "8ª": "8ª",
  "8a": "8ª",
  "8è": "8ª",
  "8e": "8ª",
  "9ª": "9ª",
  "9a": "9ª",
  "9è": "9ª",
  "9e": "9ª",
  "10ª": "10ª",
  "10a": "10ª",
  "10è": "10ª",
  "10e": "10ª",
  "11ª": "11ª",
  "11a": "11ª",
  "11è": "11ª",
  "11e": "11ª",
  "12ª": "12ª",
  "12a": "12ª",
  "12è": "12ª",
  "12e": "12ª",
  "13ª": "13ª",
  "13a": "13ª",
  "13è": "13ª",
  "13e": "13ª",
};

export function normalizeAngolaSecondaryLevel(
  level: string | null | undefined,
): AngolaSecondaryLevel | null {
  if (!level) return null;
  return ANGOLA_LEVEL_ALIASES[level.trim()] ?? null;
}

export const ANGOLA_CICLO1_SECTION_CODE = "CICLO1";
export const ANGOLA_CICLO1_SECTION_NAME = "Núcleo comum";
export const ANGOLA_SECONDARY_CYCLE_LABEL = "Ensino secundário";
export const ANGOLA_CICLO_OPTION_CODE = "NUCLEO";
export const ANGOLA_CICLO_OPTION_NAME = "Núcleo comum";
export const ANGOLA_CICLO_OPTION_CODE_LEGACY = "CICLO";
export const ANGOLA_CICLO2_SECTION_CODE = "CICLO2";
export const ANGOLA_CICLO2_SECTION_NAME = "2.º Ciclo";
export const ANGOLA_TECNICA_SECTION_CODE = "TECNICA";
export const ANGOLA_TECNICA_SECTION_NAME = "Técnica";
export const ANGOLA_ELECT_OPTION_CODE = "ELECT";
export const ANGOLA_ELECT_OPTION_NAME = "Electricidade";
export const ANGOLA_ELECT_OPTION_ABBREV = "EL";

export function isAngolaNucleoComumOption(option: {
  codeOption?: string | null;
  nameOption?: string | null;
}): boolean {
  const code = option.codeOption?.toUpperCase();
  const name = option.nameOption?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return (
    code === ANGOLA_CICLO_OPTION_CODE ||
    code === ANGOLA_CICLO_OPTION_CODE_LEGACY ||
    name === "nucleo comum" ||
    name === "ciclo"
  );
}

export function isAngolaNucleoComumSection(section: {
  codeSection?: string | null;
  nameSection?: string | null;
}): boolean {
  const code = section.codeSection?.toUpperCase();
  const name = section.nameSection?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return (
    code === ANGOLA_CICLO1_SECTION_CODE ||
    name === "nucleo comum" ||
    name === "1.o ciclo" ||
    name === "ensino secundario"
  );
}

export function isAngolaSecondarySystem(
  typebranch: unknown,
  educationSystem?: unknown,
): boolean {
  return (
    typebranch === "SECONDAIRE" &&
    normalizeEducationSystem(educationSystem) === "ANGOLAIS"
  );
}

export function isAngolaSecondaryLevel(
  level: string | null | undefined,
): level is AngolaSecondaryLevel {
  return normalizeAngolaSecondaryLevel(level) !== null;
}

export function isAngolaFirstCycleLevel(level: string | null | undefined): boolean {
  const normalized = normalizeAngolaSecondaryLevel(level);
  return (
    !!normalized &&
    (ANGOLA_FIRST_CYCLE_LEVELS as readonly string[]).includes(normalized)
  );
}

export function isAngolaSecondCycleLevel(level: string | null | undefined): boolean {
  const normalized = normalizeAngolaSecondaryLevel(level);
  return (
    !!normalized &&
    (ANGOLA_SECOND_CYCLE_LEVELS as readonly string[]).includes(normalized)
  );
}

export function isAngolaReducedHoursLevel(
  level: string | null | undefined,
): boolean {
  return normalizeAngolaSecondaryLevel(level) === ANGOLA_REDUCED_LEVEL;
}

export function getAngolaSecondaryCycle(
  level: string | null | undefined,
): AngolaSecondaryCycle | null {
  if (isAngolaFirstCycleLevel(level)) return "CICLO1";
  if (isAngolaSecondCycleLevel(level) || isAngolaReducedHoursLevel(level)) {
    return "CICLO2";
  }
  return null;
}

/** 7ª–12ª : tous les jours. 13ª : horaire réduit. */
export function getAngolaHoraireType(
  level: string | null | undefined,
): AngolaHoraireType {
  return isAngolaReducedHoursLevel(level) ? "REDUIT" : "COMPLET";
}

export function angolaSecondaryLevelLabel(level: string): string {
  const normalized = normalizeAngolaSecondaryLevel(level) ?? level;
  const labels: Record<string, string> = {
    "7ª": "7ª (Sétima Classe)",
    "8ª": "8ª (Oitava Classe)",
    "9ª": "9ª (Nona Classe)",
    "10ª": "10ª (Décima Classe)",
    "11ª": "11ª (Décima Primeira Classe)",
    "12ª": "12ª (Décima Segunda Classe)",
    "13ª": "13ª (Décima Terceira Classe)",
  };
  return labels[normalized] ?? level;
}

/** Libellé officiel type « 7ª (Sétima Classe) » (Declaração de estudo). */
export function angolaStudyDeclarationClassPhrase(
  level?: string | null,
): string {
  const normalized =
    normalizeAngolaSecondaryLevel(level) ??
    extractAngolaSecondaryLevelFromLabel(level);
  const phrases: Record<string, string> = {
    "7ª": "7ª (Sétima Classe)",
    "8ª": "8ª (Oitava Classe)",
    "9ª": "9ª (Nona Classe)",
    "10ª": "10ª (Décima Classe)",
    "11ª": "11ª (Décima Primeira Classe)",
    "12ª": "12ª (Décima Segunda Classe)",
    "13ª": "13ª (Décima Terceira Classe)",
  };
  if (normalized && phrases[normalized]) return phrases[normalized];
  return level?.trim() || "_______ Classe";
}

export function extractAngolaSecondaryLevelFromLabel(
  value?: string | null,
): AngolaSecondaryLevel | null {
  if (!value) return null;
  const direct = normalizeAngolaSecondaryLevel(value);
  if (direct) return direct;
  const match = value.match(/\b(13|12|11|10|7|8|9)\s*[ªaàèe]/i);
  if (!match) return null;
  return normalizeAngolaSecondaryLevel(`${match[1]}ª`);
}

export function shouldUseAngolaStudyDeclaration(
  educationSystem: unknown,
  classLevel?: string | null,
  classLabel?: string | null,
  branchType?: unknown,
): boolean {
  if (normalizeEducationSystem(educationSystem) !== "ANGOLAIS") return false;
  const extracted =
    extractAngolaSecondaryLevelFromLabel(classLevel) ??
    extractAngolaSecondaryLevelFromLabel(classLabel);
  if (extracted) return true;
  if (branchType === "PRIMAIRE" || branchType === "MATERNELLE") return false;
  return branchType === "SECONDAIRE";
}

export function isAngolaTecnicaSection(section: {
  codeSection?: string | null;
  nameSection?: string | null;
}): boolean {
  const code = section.codeSection?.toUpperCase();
  const name = section.nameSection
    ?.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return code === ANGOLA_TECNICA_SECTION_CODE || name === "tecnica";
}

export function isAngolaElectOption(option: {
  codeOption?: string | null;
  nameOption?: string | null;
}): boolean {
  const code = option.codeOption?.toUpperCase();
  const name = option.nameOption
    ?.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return (
    code === ANGOLA_ELECT_OPTION_CODE ||
    name === "electricidade" ||
    name === "electrotecnia"
  );
}

export function angolaHoraireHelp(level: string | null | undefined): string {
  if (isAngolaFirstCycleLevel(level)) {
    return "7ª–8ª : núcleo comum (comme le tronc commun). Pas d'option ni de filière à choisir.";
  }
  if (isAngolaSecondCycleLevel(level)) {
    return "9ª–12ª : 2.º Ciclo, section et option obligatoires (défaut Técnica / Electricidade). Horaire complet.";
  }
  if (isAngolaReducedHoursLevel(level)) {
    return "13ª : 2.º Ciclo (longo), section et option obligatoires. Horaire réduit, cours pas tous les jours.";
  }
  return "";
}

export function angolaRequiresArea(level: string | null | undefined): boolean {
  return (
    isAngolaSecondCycleLevel(level) || isAngolaReducedHoursLevel(level)
  );
}
