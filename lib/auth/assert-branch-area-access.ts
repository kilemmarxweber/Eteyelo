import "server-only";

import { notFound, redirect } from "next/navigation";

import {
  canAccessBranchArea,
  type BranchArea,
} from "@/lib/auth/branch-area-access";
import { isPermissionsFromDacEnabled } from "@/lib/auth/branch-area-permissions";
import { getCachedSession } from "@/lib/auth/get-session-cached";
import { loadOrganizationRoleStatements } from "@/lib/auth/org-role-permissions";
import { canAccessBranchAreaFromPermissions } from "@/lib/auth/resolve-branch-area-permission";

export type { BranchArea };
export { canAccessBranchArea };

export type AssertBranchAreaOptions = {
  /**
   * `redirect` → dashboard branche (défaut si org+branch connus).
   * `notFound` → 404 (comportement historique de nombreuses pages).
   */
  onDeny?: "redirect" | "notFound";
  organizationId?: string | null;
  branchId?: string | null;
};

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

function resolveOrganizationId(
  session: any,
  organizationId?: string | null,
): string | null {
  return (
    organizationId ??
    session?.organization?.id ??
    session?.session?.activeOrganizationId ??
    null
  );
}

/**
 * Refuse l’accès serveur à une zone branche.
 * Préférer cet helper aux checks ad hoc dans chaque page/layout.
 * Lit OrganizationRole.permission (DB) quand le DAC est actif.
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

  const orgId = resolveOrganizationId(resolved, options?.organizationId);
  let allowed = false;

  if (isPermissionsFromDacEnabled() && orgId) {
    const roleStatements = await loadOrganizationRoleStatements(orgId);
    allowed = canAccessBranchAreaFromPermissions(
      area,
      resolved,
      roleStatements,
    );
  } else {
    allowed = canAccessBranchArea(area, resolved);
  }

  if (allowed) {
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

/** Check zone avec permissions DB (sans redirect). */
export async function canAccessBranchAreaAsync(
  area: BranchArea,
  session: unknown,
  organizationId?: string | null,
): Promise<boolean> {
  if (!isPermissionsFromDacEnabled()) {
    return canAccessBranchArea(area, session);
  }

  const orgId = resolveOrganizationId(session, organizationId);
  if (!orgId) {
    return canAccessBranchAreaFromPermissions(area, session);
  }

  const roleStatements = await loadOrganizationRoleStatements(orgId);
  return canAccessBranchAreaFromPermissions(area, session, roleStatements);
}
