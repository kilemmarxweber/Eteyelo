import { requiresOptionForClass } from "@/lib/class-structure";

export type ClassForLevelMatch = {
  level: string | null;
  optionId: string | null;
  nameClasse: string;
  option?: { id: string; nameOption: string } | null;
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function classMatchesLevel(classe: ClassForLevelMatch, level: string) {
  const classLevel = classe.level?.trim();
  if (classLevel) return classLevel === level;
  return new RegExp(`^${escapeRegex(level)}\\b`, "i").test(classe.nameClasse.trim());
}

function classMatchesOption(
  classe: ClassForLevelMatch,
  optionId: string | null,
  optionName?: string | null,
) {
  if (classe.optionId) return classe.optionId === optionId;

  const resolvedOptionName = optionName ?? classe.option?.nameOption;
  if (!resolvedOptionName) return false;

  return classe.nameClasse.toLowerCase().includes(resolvedOptionName.toLowerCase());
}

export function matchesClassForLevel(
  classe: ClassForLevelMatch,
  params: {
    typebranch: unknown;
    level: string;
    optionId?: string | null;
    optionName?: string | null;
  },
): boolean {
  const level = params.level.trim();
  if (!level) return false;
  if (!classMatchesLevel(classe, level)) return false;

  const optionRequired = requiresOptionForClass(params.typebranch, level);
  const optionId = params.optionId?.trim() || null;

  if (!optionRequired) {
    if (!optionId) return true;
    return !classe.optionId || classe.optionId === optionId;
  }

  if (!optionId) return false;
  return classMatchesOption(classe, optionId, params.optionName);
}
