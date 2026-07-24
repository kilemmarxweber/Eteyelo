/** Définitions métier figées pour les rapports organisation. */

/** Satisfaction parent positive. */
export const SATISFACTION_POSITIVE_MIN = 4;

/** Seuil de réussite (%) — aligné branch dashboard. */
export const SUCCESS_THRESHOLD_PERCENT = 50;

/** Présence effective élève / enseignant. */
export const PRESENT_STATUSES = ["PRESENT", "LATE"] as const;

export const REPORT_TABS = [
  "overview",
  "effectifs",
  "presences",
  "finance",
  "satisfaction",
  "resultats",
  "rh",
  "inscriptions",
] as const;

export type ReportTab = (typeof REPORT_TABS)[number];

export type ReportScope = "branch" | "all";

export type OrgReportFilters = {
  organizationId: string;
  scope: ReportScope;
  /** Requis si scope === "branch" */
  branchId?: string;
  /** `all` ou nameYear (ex. "2025-2026") */
  schoolYearKey: string;
  tab: ReportTab;
};

export function isReportTab(value: string | undefined): value is ReportTab {
  return !!value && (REPORT_TABS as readonly string[]).includes(value);
}
