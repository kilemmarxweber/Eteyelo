import {
  getAcademicStructure,
  type ManagedBranchType,
} from "@/lib/academic-structure";

/** Lien sans période fixe : avance auto quand la fiche de cote est validée. */
export const ATELIER_LINK_PERIOD_AUTO = "AUTO";

export type AtelierLinkSecondaryCourseOption = {
  id: string;
  nameCours: string;
  codeCours: string;
  branchId: string;
  branchName: string;
  /** Libellé UI : « Chimie · Collège X » */
  label: string;
  /**
   * Clés option:niveau pour lesquelles le cours est pondéré en secondaire
   * (niveau vide = tous les niveaux de l'option).
   */
  secondaryOptionKeys: string[];
};

export type AtelierLinkSecondaryClassOption = {
  id: string;
  label: string;
  branchId: string;
  optionId: string | null;
  level: string | null;
  /** Cours secondaires du curriculum (option + niveau). Peut être vide. */
  configuredCoursIds: string[];
};

export type AtelierLinkOptions = {
  /** Cours SUBJECT des branches SECONDAIRE uniquement (jamais domaines bulletin). */
  courses: AtelierLinkSecondaryCourseOption[];
  /** Classes secondaires pour filtrer les cours (curriculum). */
  classes: AtelierLinkSecondaryClassOption[];
  periodsByBranchId: Record<string, Array<{ key: string; label: string }>>;
};

/** Clé option + niveau pour filtrer un cours par classe source. */
export function secondaryOptionKey(
  optionId: string,
  level?: string | null,
): string {
  return `${optionId}:${(level ?? "").trim()}`;
}

/**
 * Cours visibles pour une classe :
 * 1) curriculum pondéré (option + niveau)
 * 2) sinon tous les cours secondaires de la même école (branche)
 */
export function filterCoursesForSecondaryClass(
  courses: AtelierLinkSecondaryCourseOption[],
  classe: Pick<
    AtelierLinkSecondaryClassOption,
    "branchId" | "configuredCoursIds"
  >,
): AtelierLinkSecondaryCourseOption[] {
  const configured = new Set(classe.configuredCoursIds);
  if (configured.size > 0) {
    return courses.filter((course) => configured.has(course.id));
  }
  return courses.filter((course) => course.branchId === classe.branchId);
}

/** @deprecated Préférer filterCoursesForSecondaryClass */
export function courseMatchesSecondaryClass(
  course: Pick<
    AtelierLinkSecondaryCourseOption,
    "id" | "secondaryOptionKeys" | "branchId"
  >,
  classe: Pick<
    AtelierLinkSecondaryClassOption,
    "optionId" | "level" | "branchId" | "configuredCoursIds"
  >,
): boolean {
  if (classe.configuredCoursIds?.length) {
    return classe.configuredCoursIds.includes(course.id);
  }
  if (classe.optionId) {
    const level = (classe.level ?? "").trim();
    const specific = secondaryOptionKey(classe.optionId, level);
    const shared = secondaryOptionKey(classe.optionId, "");
    if (
      course.secondaryOptionKeys.includes(specific) ||
      course.secondaryOptionKeys.includes(shared)
    ) {
      return true;
    }
  }
  return course.branchId === classe.branchId;
}

export type AtelierCourseLinkView = {
  secondaryCoursId: string;
  secondaryCoursName: string;
  secondaryBranchId: string;
  secondaryBranchName: string;
  /** AUTO ou clé période (p1, p2…). */
  targetPeriodKey: string;
  targetPeriodLabel: string;
  /** Période réellement active si AUTO. */
  activePeriodKey?: string | null;
  activePeriodLabel?: string | null;
  isPeriodAuto?: boolean;
};

export function listSecondaryPeriodOptions(educationSystem?: unknown) {
  const structure = getAcademicStructure("SECONDAIRE", educationSystem);
  return structure.periods.map((period) => ({
    key: period.key,
    label: period.label,
  }));
}

export function isAtelierPeriodAuto(key: string | null | undefined): boolean {
  return !key || key === ATELIER_LINK_PERIOD_AUTO;
}

export function periodLabelForKey(
  key: string,
  typebranch: ManagedBranchType,
  educationSystem: unknown,
): string {
  if (key === ATELIER_LINK_PERIOD_AUTO) {
    return "Période active (auto)";
  }
  const structure = getAcademicStructure(typebranch, educationSystem);
  return structure.periods.find((period) => period.key === key)?.label ?? key;
}
