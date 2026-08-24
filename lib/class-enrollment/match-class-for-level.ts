import { requiresOptionForClass } from "@/lib/class-structure";
import {
  isAngolaFirstCycleLevel,
  normalizeAngolaSecondaryLevel,
} from "@/lib/angola-secondary-structure";

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
  if (classLevel) {
    if (classLevel === level) return true;
    const angolaClass = normalizeAngolaSecondaryLevel(classLevel);
    const angolaLevel = normalizeAngolaSecondaryLevel(level);
    return Boolean(angolaClass && angolaLevel && angolaClass === angolaLevel);
  }
  return new RegExp(`^${escapeRegex(level)}\\b`, "i").test(classe.nameClasse.trim());
}

function classMatchesOption(
  classe: ClassForLevelMatch,
  optionId: string | null,
  optionName?: string | null,
) {
  if (optionId) {
    if (classe.optionId) return classe.optionId === optionId;
    if (classe.option?.id) return classe.option.id === optionId;
  }

  const resolvedOptionName = optionName ?? classe.option?.nameOption;
  if (!resolvedOptionName) return false;

  if (classe.option?.nameOption) {
    return (
      classe.option.nameOption.toLowerCase() ===
        resolvedOptionName.toLowerCase() ||
      classe.nameClasse.toLowerCase().includes(resolvedOptionName.toLowerCase())
    );
  }

  return classe.nameClasse
    .toLowerCase()
    .includes(resolvedOptionName.toLowerCase());
}

export function matchesClassForLevel(
  classe: ClassForLevelMatch,
  params: {
    typebranch: unknown;
    level: string;
    optionId?: string | null;
    optionName?: string | null;
    educationSystem?: unknown;
  },
): boolean {
  const level = params.level.trim();
  if (!level) return false;
  if (!classMatchesLevel(classe, level)) return false;

  if (isAngolaFirstCycleLevel(level)) return true;

  const optionRequired = requiresOptionForClass(
    params.typebranch,
    level,
    params.educationSystem,
  );
  const optionId = params.optionId?.trim() || null;
  const optionName = params.optionName?.trim() || null;

  if (!optionRequired) {
    if (!optionId && !optionName) return true;
    if (optionId) return !classe.optionId || classe.optionId === optionId;
    return classMatchesOption(classe, null, optionName);
  }

  if (!optionId && !optionName) return false;
  return classMatchesOption(classe, optionId, optionName);
}
