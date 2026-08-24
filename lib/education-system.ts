export const EDUCATION_SYSTEMS = ["CONGOLAIS", "ANGOLAIS", "ANGLAIS"] as const;

export type EducationSystem = (typeof EDUCATION_SYSTEMS)[number];

export const DEFAULT_EDUCATION_SYSTEM: EducationSystem = "CONGOLAIS";

export function isEducationSystem(value: unknown): value is EducationSystem {
  return (
    typeof value === "string" &&
    EDUCATION_SYSTEMS.includes(value as EducationSystem)
  );
}

export function normalizeEducationSystem(value: unknown): EducationSystem {
  return isEducationSystem(value) ? value : DEFAULT_EDUCATION_SYSTEM;
}

export function isCongoleseEducationSystem(value: unknown): boolean {
  return normalizeEducationSystem(value) === "CONGOLAIS";
}

export function isSchoolBranchType(typebranch: unknown): boolean {
  return typebranch === "PRIMAIRE" || typebranch === "SECONDAIRE";
}

/** Calendrier 3 trimestres × 1 période : primaire/secondaire angolais ou anglais. */
export function usesTermPeriodCalendar(
  typebranch: unknown,
  educationSystem?: unknown,
): boolean {
  if (!isSchoolBranchType(typebranch)) return false;
  const system = normalizeEducationSystem(educationSystem);
  return system === "ANGOLAIS" || system === "ANGLAIS";
}

export function effectiveEducationSystem(
  typebranch: unknown,
  educationSystem?: unknown,
): EducationSystem {
  const system = normalizeEducationSystem(educationSystem);
  return usesTermPeriodCalendar(typebranch, system) ? system : DEFAULT_EDUCATION_SYSTEM;
}

export function educationSystemLabel(system: EducationSystem): string {
  switch (system) {
    case "ANGOLAIS":
      return "Enseignement angolais";
    case "ANGLAIS":
      return "Enseignement anglais";
    default:
      return "Enseignement congolais";
  }
}

export function bulletinLocaleForEducationSystem(
  educationSystem: unknown,
): "fr" | "pt" | "en" {
  switch (normalizeEducationSystem(educationSystem)) {
    case "ANGOLAIS":
      return "pt";
    case "ANGLAIS":
      return "en";
    default:
      return "fr";
  }
}
