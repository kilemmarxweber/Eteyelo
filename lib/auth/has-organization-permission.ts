import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isPlatformOwnerRole } from "@/lib/permissions";
import {
  getOrganizationAuthContext,
  guardOrganizationAccess,
  type OrganizationAuthContext,
  type OrganizationGuardFailure,
} from "@/lib/auth/require-organization-permission";
import {
  grantsCoverPermissions,
  loadActiveTemporaryGrants,
} from "@/lib/auth/temporary-privilege";

export type OrganizationPermissionPayload = Record<string, string[]>;

export type OrganizationPermissionCheckResult =
  | { ok: true; bypassed: boolean }
  | { ok: false; message: string };

async function checkTemporaryGrantsForPermissions(
  userId: string,
  organizationId: string,
  permissions: OrganizationPermissionPayload,
  branchId?: string | null,
): Promise<boolean> {
  const grants = await loadActiveTemporaryGrants(
    userId,
    organizationId,
    branchId,
  );
  return grantsCoverPermissions(grants, permissions);
}

export async function checkOrganizationPermission(
  organizationId: string,
  permissions: OrganizationPermissionPayload,
  options?: { branchId?: string | null },
): Promise<OrganizationPermissionCheckResult> {
  const context = await getOrganizationAuthContext();
  if (!context) {
    return { ok: false, message: "Session introuvable." };
  }

  if (isPlatformOwnerRole(context.appRole)) {
    return { ok: true, bypassed: true };
  }

  try {
    const result = await auth.api.hasPermission({
      headers: await headers(),
      body: {
        organizationId,
        permissions,
      },
    });

    if (result && "success" in result && result.success) {
      return { ok: true, bypassed: false };
    }

    const covered = await checkTemporaryGrantsForPermissions(
      context.userId,
      organizationId,
      permissions,
      options?.branchId,
    );
    if (covered) {
      return { ok: true, bypassed: false };
    }

    return {
      ok: false,
      message: "Permission refusee pour cette action.",
    };
  } catch {
    const covered = await checkTemporaryGrantsForPermissions(
      context.userId,
      organizationId,
      permissions,
      options?.branchId,
    );
    if (covered) {
      return { ok: true, bypassed: false };
    }

    return {
      ok: false,
      message: "Permission refusee pour cette action.",
    };
  }
}

export type OrganizationMemberPermissionGuardSuccess = {
  ok: true;
  context: OrganizationAuthContext;
  bypassed: boolean;
};

export type OrganizationMemberPermissionGuardResult =
  | OrganizationMemberPermissionGuardSuccess
  | OrganizationGuardFailure;

export async function guardOrganizationMemberPermission(
  organizationId: string,
  permissions: OrganizationPermissionPayload,
  options?: { branchId?: string | null },
): Promise<OrganizationMemberPermissionGuardResult> {
  const access = await guardOrganizationAccess(organizationId);
  if (!access.ok) {
    return access;
  }

  const permission = await checkOrganizationPermission(
    organizationId,
    permissions,
    options,
  );
  if (!permission.ok) {
    return { ok: false, message: permission.message };
  }

  return {
    ok: true,
    context: access.context,
    bypassed: permission.bypassed,
  };
}
