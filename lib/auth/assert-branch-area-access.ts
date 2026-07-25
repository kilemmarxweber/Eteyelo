import { notFound, redirect } from "next/navigation";

import { getCachedSession } from "@/lib/auth/get-session-cached";
import {
  canAccessBranchOrgSettings,
  canAccessFinanceArea,
  canAccessLibraryArea,
  canAccessNotesReadArea,
  canAccessPedagogyArea,
  canAccessResultsArea,
  canAccessScheduleReadArea,
  canAccessTeachingArea,
  canManageHrDirectory,
} from "@/lib/auth/session-roles";

/**
 * Zones sensibles sous `.../branches/[branchId]/` (unit-09).
 * Un seul point pour éviter la dérive des gates pages/layouts.
 */
export type BranchArea =
  | "finance"
  | "notes"
  | "schedule"
  | "teaching"
  | "pedagogy"
  | "results"
  | "library"
  | "school_admin"
  | "hr_directory"
  | "hr_write"
  | "branch_org_settings";

export type AssertBranchAreaOptions = {
  /**
   * `redirect` → dashboard branche (défaut si org+branch connus).
   * `notFound` → 404 (comportement historique de nombreuses pages).
   */
  onDeny?: "redirect" | "notFound";
  organizationId?: string | null;
  branchId?: string | null;
};

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
    case "results":
      return canAccessResultsArea(session);
    case "library":
      return canAccessLibraryArea(session);
    case "hr_directory":
      return canAccessPedagogyArea(session);
    case "hr_write":
      return canManageHrDirectory(session);
    case "branch_org_settings":
      return canAccessBranchOrgSettings(session);
    default: {
      const _exhaustive: never = area;
      return _exhaustive;
    }
  }
}

function resolveBranchHome(
  session: any,
  organizationId?: string | null,
  branchId?: string | null,
): string | null {
  const orgId =
    organizationId ??
    session?.organization?.id ??
    session?.session?.activeOrganizationId;
  const brId =
    branchId ?? session?.branch?.id ?? session?.session?.activeBranchId;

  if (!orgId || !brId) return null;
  return `/admin/organizations/${orgId}/branches/${brId}`;
}

/**
 * Refuse l’accès serveur à une zone branche.
 * Préférer cet helper aux checks ad hoc dans chaque page/layout.
 */
export async function assertBranchAreaAccess(
  area: BranchArea,
  session?: unknown | null,
  options?: AssertBranchAreaOptions,
): Promise<NonNullable<Awaited<ReturnType<typeof getCachedSession>>>> {
  const resolved =
    session === undefined || session === null
      ? await getCachedSession()
      : session;

  if (!resolved || !(resolved as { user?: { id?: string } }).user?.id) {
    redirect("/auth/sign-in");
  }

  if (canAccessBranchArea(area, resolved)) {
    return resolved as NonNullable<Awaited<ReturnType<typeof getCachedSession>>>;
  }

  const onDeny =
    options?.onDeny ??
    (resolveBranchHome(
      resolved,
      options?.organizationId,
      options?.branchId,
    )
      ? "redirect"
      : "notFound");

  if (onDeny === "redirect") {
    const home = resolveBranchHome(
      resolved,
      options?.organizationId,
      options?.branchId,
    );
    if (home) redirect(home);
  }

  notFound();
}
