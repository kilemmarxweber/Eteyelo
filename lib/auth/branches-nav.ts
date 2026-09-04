import { memberHasImplicitAllBranchAccess } from "@/lib/auth/role-labels";
import { isPlatformOwnerRole } from "@/lib/permissions";

export function canUseOrganizationBranchesList(session: unknown): boolean {
  const value = session as {
    user?: { role?: string | null } | null;
    organization?: { role?: string | null } | null;
  } | null;

  if (isPlatformOwnerRole(value?.user?.role)) return true;
  return memberHasImplicitAllBranchAccess(value?.organization?.role);
}

export function resolveBranchesNavHref(input: {
  organizationId: string;
  useBranchesList: boolean;
  accessibleBranchCount: number;
}): string | null {
  const organizationId = input.organizationId.trim();
  if (!organizationId) return null;

  if (input.useBranchesList) {
    return `/admin/organizations/${organizationId}/branches`;
  }

  if (input.accessibleBranchCount > 1) {
    return `/admin/organizations/${organizationId}/branch-picker`;
  }

  return null;
}
