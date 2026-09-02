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
import { canAccessBranchAreaViaTemporaryGrants } from "@/lib/auth/temporary-privilege";

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
  const userId = (resolved as { user?: { id?: string } }).user?.id;
  const branchId =
    options?.branchId ??
    (resolved as { branch?: { id?: string }; session?: { activeBranchId?: string } })
      .branch?.id ??
    (resolved as { session?: { activeBranchId?: string } }).session?.activeBranchId ??
    null;
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

  if (!allowed && orgId && userId) {
    allowed = await canAccessBranchAreaViaTemporaryGrants(
      userId,
      orgId,
      area,
      branchId,
    );
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
  branchId?: string | null,
): Promise<boolean> {
  const orgId = resolveOrganizationId(session, organizationId);
  const userId = (session as { user?: { id?: string } } | null)?.user?.id;
  const resolvedBranchId =
    branchId ??
    (session as { branch?: { id?: string }; session?: { activeBranchId?: string } } | null)
      ?.branch?.id ??
    (session as { session?: { activeBranchId?: string } } | null)?.session
      ?.activeBranchId ??
    null;

  let allowed = false;

  if (!isPermissionsFromDacEnabled()) {
    allowed = canAccessBranchArea(area, session);
  } else if (!orgId) {
    allowed = canAccessBranchAreaFromPermissions(area, session);
  } else {
    const roleStatements = await loadOrganizationRoleStatements(orgId);
    allowed = canAccessBranchAreaFromPermissions(
      area,
      session,
      roleStatements,
    );
  }

  if (!allowed && orgId && userId) {
    allowed = await canAccessBranchAreaViaTemporaryGrants(
      userId,
      orgId,
      area,
      resolvedBranchId,
    );
  }

  return allowed;
}
