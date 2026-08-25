import { requiresOptionForClass } from "@/lib/class-structure";
import {
  isAngolaFirstCycleLevel,
  normalizeAngolaSecondaryLevel,
} from "@/lib/angola-secondary-structure";
import { normalizeCycle, type Cycle } from "@/lib/cycle";

export type ClassForLevelMatch = {
  level: string | null;
  optionId: string | null;
  nameClasse: string;
  cycle?: string | null;
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

function classMatchesCycle(
  classe: ClassForLevelMatch,
  cycle?: Cycle | null,
): boolean {
  if (!cycle) return true;
  if (classe.cycle) return normalizeCycle(classe.cycle) === cycle;

  const name = classe.nameClasse ?? "";
  if (cycle === "MATERNELLE") {
    return /(-MATE\b|Crèche|Creche)/i.test(name);
  }
  if (cycle === "PRIMAIRE") {
    return /-PR\b/i.test(name);
  }
  if (cycle === "SECONDAIRE") {
    return !/(-MATE\b|-PR\b|Crèche|Creche)/i.test(name);
  }
  return true;
}

export function matchesClassForLevel(
  classe: ClassForLevelMatch,
  params: {
    typebranch: unknown;
    level: string;
    optionId?: string | null;
    optionName?: string | null;
    educationSystem?: unknown;
    cycle?: unknown;
  },
): boolean {
  const level = params.level.trim();
  if (!level) return false;

  const cycle = params.cycle != null && params.cycle !== ""
    ? normalizeCycle(params.cycle)
    : undefined;
  if (!classMatchesCycle(classe, cycle ?? null)) return false;
  if (!classMatchesLevel(classe, level)) return false;

  if (isAngolaFirstCycleLevel(level)) return true;

  const structureType = cycle ?? params.typebranch;
  const optionRequired = requiresOptionForClass(
    structureType,
    level,
    params.educationSystem,
  );
  const optionId = params.optionId?.trim() || null;
  const optionName = params.optionName?.trim() || null;

  if (!optionRequired) {
    return true;
  }

  if (!optionId && !optionName) return false;
  return classMatchesOption(classe, optionId, optionName);
}
