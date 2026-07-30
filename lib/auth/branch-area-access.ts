import {
  canAccessBranchOrgSettings,
  canAccessDevoirsArea,
  canAccessFinanceArea,
  canAccessLibraryArea,
  canAccessNotesReadArea,
  canAccessPedagogyArea,
  canAccessRegistrationArea,
  canAccessResultsArea,
  canAccessScheduleReadArea,
  canAccessSchoolOpsSettings,
  canAccessStudentDirectory,
  canAccessSupportSettings,
  canAccessTeachingArea,
  canAccessTitulaireFichesArea,
  canManageHrDirectory,
} from "@/lib/auth/session-roles";

/**
 * Zones sensibles sous `.../branches/[branchId]/` (unit-09).
 * Module client-safe (pas de next/headers).
 */
export type BranchArea =
  | "finance"
  | "notes"
  | "schedule"
  | "teaching"
  | "pedagogy"
  | "results"
  | "devoirs"
  | "library"
  | "school_admin"
  | "registration"
  | "students"
  | "hr_directory"
  | "hr_write"
  | "branch_org_settings"
  | "school_ops_settings"
  | "support_settings"
  | "fiches";

export function canAccessBranchArea(
  area: BranchArea,
  session: unknown,
): boolean {
  switch (area) {
    case "finance":
      return canAccessFinanceArea(session);
    case "notes":
      return canAccessNotesReadArea(session);
    case "schedule":
      return canAccessScheduleReadArea(session);
    case "teaching":
      return canAccessTeachingArea(session);
    case "pedagogy":
    case "school_admin":
      return canAccessPedagogyArea(session);
    case "registration":
      return canAccessRegistrationArea(session);
    case "students":
      return canAccessStudentDirectory(session);
    case "results":
      return canAccessResultsArea(session);
    case "devoirs":
      return canAccessDevoirsArea(session);
    case "library":
      return canAccessLibraryArea(session);
    case "hr_directory":
      return canAccessPedagogyArea(session);
    case "hr_write":
      return canManageHrDirectory(session);
    case "branch_org_settings":
      return canAccessBranchOrgSettings(session);
    case "school_ops_settings":
      return canAccessSchoolOpsSettings(session);
    case "support_settings":
      return canAccessSupportSettings(session);
    case "fiches":
      return canAccessTitulaireFichesArea(session);
    default: {
      const _exhaustive: never = area;
      return _exhaustive;
    }
  }
}
