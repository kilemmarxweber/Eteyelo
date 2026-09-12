import {
  isPrimaryLikeCycle,
  normalizeCycle,
  type Cycle,
} from "@/lib/cycle";
import {
  PRIMARY_CRENEAU_WORKING_DAYS,
  normalizeCreneauWorkingDays,
} from "@/lib/creneau-working-days";

export type VacationCycleHint = {
  nameCreneau?: string | null;
  durationCourse?: number | null;
  workingDays?: unknown[] | null;
};

const PRIMARY_NAME_HINTS = [
  "primaire",
  "primary",
  "primario",
  "maternelle",
  "kindergarten",
  "jardim",
];
const SECONDARY_NAME_HINTS = [
  "secondaire",
  "secondary",
  "secundario",
  "humanites",
];

function foldLatin(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function nameIncludesHint(name: string, hints: readonly string[]) {
  const folded = foldLatin(name);
  return hints.some((hint) => folded.includes(hint));
}

function isPrimaryWorkingDays(days: unknown[] | null | undefined): boolean {
  const normalized = normalizeCreneauWorkingDays(days);
  return (
    normalized.length === PRIMARY_CRENEAU_WORKING_DAYS.length &&
    PRIMARY_CRENEAU_WORKING_DAYS.every((day, index) => day === normalized[index])
  );
}

/**
 * Cycle probable d'une vacation (libellé preset, ou 40 min / lun–ven).
 * `null` = vacation générique, affichable sur tous les cycles.
 */
export function inferVacationCycle(
  vacation: VacationCycleHint | null | undefined,
): Cycle | null {
  if (!vacation) return null;
  const name = vacation.nameCreneau?.trim() ?? "";
  if (nameIncludesHint(name, PRIMARY_NAME_HINTS)) return "PRIMAIRE";
  if (nameIncludesHint(name, SECONDARY_NAME_HINTS)) return "SECONDAIRE";
  if (
    vacation.durationCourse === 40 &&
    isPrimaryWorkingDays(vacation.workingDays)
  ) {
    return "PRIMAIRE";
  }
  return null;
}

/** Une vacation clairement primaire ne doit pas figurer sur l'horaire secondaire. */
export function vacationBelongsToCycle(
  vacation: VacationCycleHint | null | undefined,
  cycle: Cycle,
): boolean {
  const inferred = inferVacationCycle(vacation);
  if (!inferred) return true;
  const requested = normalizeCycle(cycle);
  if (isPrimaryLikeCycle(requested) && isPrimaryLikeCycle(inferred)) {
    return true;
  }
  return inferred === requested;
}
