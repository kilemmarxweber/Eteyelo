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
};

export type AtelierLinkOptions = {
  /** Cours SUBJECT des branches SECONDAIRE uniquement (jamais domaines bulletin). */
  courses: AtelierLinkSecondaryCourseOption[];
  periodsByBranchId: Record<string, Array<{ key: string; label: string }>>;
};

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
