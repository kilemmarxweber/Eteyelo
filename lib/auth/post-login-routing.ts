import { APP_ROLE, ORG_ROLE } from "@/lib/permissions";
import { buildBranchPickerPath } from "@/lib/auth/user-branch-access";

const ECODIM_ORG_ROLES = new Set<string>([
  ORG_ROLE.RESPONSABLE,
  ORG_ROLE.MONITEUR,
  ORG_ROLE.SURVEILLANT,
]);

const ORG_HOME_ROLES = new Set<string>([
  ORG_ROLE.OWNER,
  ORG_ROLE.GESTIONNAIRE,
]);

function splitRoles(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

export function resolveStaticAppRolePostLoginPath(
  appRole: string | null | undefined,
): string | null {
  const role = (appRole ?? "").trim().toLowerCase();

  if (role === APP_ROLE.OWNER) {
    return "/admin";
  }

  if (role === APP_ROLE.PLATFORM_SUPPORT) {
    return "/admin/platform-support";
  }

  return null;
}

export function resolveAppAdminPostLoginPath(
  organizationId: string | null | undefined,
): string {
  if (!organizationId) {
    return "/admin/no-organization";
  }

  return `/admin/organizations/${organizationId}`;
}

export function resolveMembershipPostLoginPath(input: {
  organizationId: string;
  membershipRole?: string | null;
  branchId?: string | null;
  branchCount?: number;
}): string {
  const base = `/admin/organizations/${input.organizationId}`;
  const roles = splitRoles(input.membershipRole);

  if (input.branchId) {
    return `${base}/branches/${input.branchId}`;
  }

  if ((input.branchCount ?? 0) > 1) {
    return buildBranchPickerPath(input.organizationId);
  }

  if (roles.some((role) => ECODIM_ORG_ROLES.has(role))) {
    return `${base}/ecodim`;
  }

  if (roles.some((role) => ORG_HOME_ROLES.has(role))) {
    return base;
  }

  return base;
}

export function buildOrganizationsApiPayload(input: {
  organizations: Array<{ id: string; name: string }>;
  canCreate: boolean;
  canDelete: boolean;
  canListAll: boolean;
  isPlatformOwner: boolean;
  isOrgManager: boolean;
  appRole: string;
  membershipRole: string | null;
  membershipOrganizationId: string | null;
}) {
  return {
    organizations: input.organizations,
    canCreate: input.canCreate,
    canDelete: input.canDelete,
    canListAll: input.canListAll,
    isPlatformOwner: input.isPlatformOwner,
    isOrgManager: input.isOrgManager,
    appRole: input.appRole,
    membershipRole: input.membershipRole,
    membershipOrganizationId: input.membershipOrganizationId,
  };
}
