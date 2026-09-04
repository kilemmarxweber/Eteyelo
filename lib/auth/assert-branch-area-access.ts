import "server-only";

import { notFound, redirect } from "next/navigation";

import {
  canAccessBranchArea,
  type BranchArea,
} from "@/lib/auth/branch-area-access";
import {
  grantResourceForArea,
  isPermissionsFromDacEnabled,
} from "@/lib/auth/branch-area-permissions";
import { getCachedSession } from "@/lib/auth/get-session-cached";
import { loadOrganizationRoleStatements } from "@/lib/auth/org-role-permissions";
import {
  canAccessBranchAreaFromPermissions,
  roleAllowsAreaAction,
} from "@/lib/auth/resolve-branch-area-permission";
import {
  canManageOrganization,
  canPermanentlyDeleteInformation,
  isOrganizationOwnerSession,
} from "@/lib/auth/session-roles";
import {
  canAccessBranchAreaViaTemporaryGrants,
  grantsCoverPermissions,
  loadActiveTemporaryGrants,
} from "@/lib/auth/temporary-privilege";

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

export type BranchAreaMutateAction = "create" | "update" | "delete";

export type BranchAreaMutationFlags = {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canWrite: boolean;
};

function resolveBranchId(
  session: unknown,
  branchId?: string | null,
): string | null {
  return (
    branchId ??
    (session as { branch?: { id?: string }; session?: { activeBranchId?: string } } | null)
      ?.branch?.id ??
    (session as { session?: { activeBranchId?: string } } | null)?.session
      ?.activeBranchId ??
    null
  );
}

/**
 * Droits d'écriture sur une zone : propriétaire, rôle gestionnaire,
 * DAC create/update/delete, ou octroi temporaire de la même action.
 * Un octroi `delete` autorise la suppression/archivage (pas le purge propriétaire).
 */
export async function getBranchAreaMutationFlags(
  area: BranchArea,
  session: unknown,
  organizationId?: string | null,
  branchId?: string | null,
  extraRoles: unknown[] = [],
): Promise<BranchAreaMutationFlags> {
  if (isOrganizationOwnerSession(session, ...extraRoles)) {
    return {
      canCreate: true,
      canUpdate: true,
      canDelete: true,
      canWrite: true,
    };
  }

  const orgId = resolveOrganizationId(session, organizationId);
  const userId = (session as { user?: { id?: string } } | null)?.user?.id;
  const resolvedBranchId = resolveBranchId(session, branchId);

  const roleCanWrite = canManageOrganization(session, ...extraRoles);
  const roleCanDelete = canPermanentlyDeleteInformation(session, ...extraRoles);

  let grantCreate = false;
  let grantUpdate = false;
  let grantDelete = false;
  if (orgId && userId) {
    const grants = await loadActiveTemporaryGrants(
      userId,
      orgId,
      resolvedBranchId,
    );
    const resource = grantResourceForArea(area);
    grantCreate = grantsCoverPermissions(grants, { [resource]: ["create"] });
    grantUpdate = grantsCoverPermissions(grants, { [resource]: ["update"] });
    grantDelete = grantsCoverPermissions(grants, { [resource]: ["delete"] });
  }

  let dacCreate = false;
  let dacUpdate = false;
  let dacDelete = false;
  if (isPermissionsFromDacEnabled() && orgId) {
    const roleStatements = await loadOrganizationRoleStatements(orgId);
    dacCreate = roleAllowsAreaAction(area, "create", session, roleStatements);
    dacUpdate = roleAllowsAreaAction(area, "update", session, roleStatements);
    dacDelete = roleAllowsAreaAction(area, "delete", session, roleStatements);
  }

  const canCreate = roleCanWrite || grantCreate || dacCreate;
  const canUpdate = roleCanWrite || grantUpdate || dacUpdate;
  const canDelete = roleCanDelete || grantDelete || dacDelete;

  return {
    canCreate,
    canUpdate,
    canDelete,
    canWrite: canCreate || canUpdate || canDelete,
  };
}

export async function canMutateBranchAreaAsync(
  area: BranchArea,
  action: BranchAreaMutateAction,
  session: unknown,
  organizationId?: string | null,
  branchId?: string | null,
): Promise<boolean> {
  const flags = await getBranchAreaMutationFlags(
    area,
    session,
    organizationId,
    branchId,
  );
  if (action === "create") return flags.canCreate;
  if (action === "update") return flags.canUpdate;
  return flags.canDelete;
}

export async function canWriteBranchAreaAsync(
  area: BranchArea,
  session: unknown,
  organizationId?: string | null,
  branchId?: string | null,
): Promise<boolean> {
  const flags = await getBranchAreaMutationFlags(
    area,
    session,
    organizationId,
    branchId,
  );
  return flags.canWrite;
}
