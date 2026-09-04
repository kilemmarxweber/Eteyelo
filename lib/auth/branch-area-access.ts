import {
  canAccessBranchOrgSettings,
  canAccessDevoirsArea,
  canAccessFinanceArea,
  canAccessFinanceOversight,
  canAccessPayrollArea,
  canAccessLibraryArea,
  canAccessNotesReadArea,
  canAccessPedagogyArea,
  canAccessRegistrationArea,
  canAccessCandidaturesArea,
  canAccessResultsArea,
  canAccessScheduleReadArea,
  canAccessSchoolOpsSettings,
  canAccessSchoolStructureSettings,
  canAccessStudentDirectory,
  canAccessSupportSettings,
  canAccessTeachingArea,
  canAccessTitulaireFichesArea,
  canManageHrDirectory,
} from "@/lib/auth/session-roles";
import {
  canAccessBranchAreaFromPermissions,
  isPermissionsFromDacEnabled,
} from "@/lib/auth/resolve-branch-area-permission";
import { isOrganizationOwnerSession } from "@/lib/auth/session-roles";
import type { BranchArea } from "@/lib/auth/branch-area-permissions";

export type { BranchArea };

/**
 * Zones sensibles sous `.../branches/[branchId]/` (unit-09).
 * Module client-safe (pas de next/headers / prisma).
 *
 * DAC : matrice `session.organization.rolePermissions` (DB).
 * Sans map session : repli seed (tests). Côté serveur, préférer
 * `assertBranchAreaAccess` qui recharge OrganizationRole.
 */
export function canAccessBranchArea(
  area: BranchArea,
  session: unknown,
): boolean {
  if (isOrganizationOwnerSession(session)) return true;

  if (isPermissionsFromDacEnabled()) {
    return canAccessBranchAreaFromPermissions(area, session);
  }

  switch (area) {
    case "finance":
      return canAccessFinanceArea(session);
    case "payroll":
      return canAccessPayrollArea(session);
    case "fee_catalog":
    case "fee_types":
    case "exchange_rates":
      return canAccessFinanceOversight(session);
    case "notes":
      return canAccessNotesReadArea(session);
    case "schedule":
      return canAccessScheduleReadArea(session);
    case "teaching":
    case "courses":
    case "ponderations":
    case "vacation":
      return canAccessTeachingArea(session);
    case "pedagogy":
    case "school_admin":
    case "sections":
    case "options":
    case "classe":
    case "finalistes":
      return canAccessPedagogyArea(session);
    case "attendance":
      return canAccessTeachingArea(session) || canAccessPedagogyArea(session);
    case "registration":
      return canAccessRegistrationArea(session);
    case "candidatures":
      return canAccessCandidaturesArea(session);
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
    case "public_communication":
    case "school_calendar":
    case "periods":
      return canAccessSchoolOpsSettings(session);
    case "school_year":
    case "structure_copy":
      return canAccessSchoolStructureSettings(session);
    case "support_settings":
      return canAccessSupportSettings(session);
    case "fiches":
    case "fiche_centrale":
      return canAccessTitulaireFichesArea(session);
    case "roles_privileges":
      return canAccessBranchOrgSettings(session);
    case "transactions":
      return canAccessPayrollArea(session);
    case "parents":
      return canAccessPedagogyArea(session);
    case "documents":
      return canAccessResultsArea(session) || canAccessPedagogyArea(session);
    default: {
      const _exhaustive: never = area;
      return _exhaustive;
    }
  }
}

