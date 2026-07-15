import { getUserOrganizationMembership } from "@/lib/auth/org-membership";
import {
  buildBranchPickerPath,
  getUserBranchMembershipsForLogin,
  resolveActiveBranchId,
} from "@/lib/auth/user-branch-access";
import { APP_ROLE, ORG_ROLE } from "@/lib/permissions";

const ECODIM_ORG_ROLES = new Set<string>([
  ORG_ROLE.DIRECTEUR,
  ORG_ROLE.PREFET,
  ORG_ROLE.SUPERVISEUR,
]);

const ORG_HOME_ROLES = new Set<string>([
  ORG_ROLE.OWNER,
  ORG_ROLE.GESTIONNAIRE,
]);

function normalizeRole(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function splitRoles(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((role) => normalizeRole(role))
    .filter(Boolean);
}

export async function getUserBranchId(userId: string, organizationId: string) {
  return resolveActiveBranchId(userId, organizationId);
}

export async function resolveUserOrganizationFallbackPath(
  userId: string,
  appRole?: string | null,
): Promise<string> {
  const role = normalizeRole(appRole);

  if (role === APP_ROLE.OWNER) {
    return "/admin";
  }

  if (role === APP_ROLE.PLATFORM_SUPPORT) {
    return "/admin/platform-support";
  }

  const membership = await getUserOrganizationMembership(userId);
  if (!membership) {
    return "/admin/no-organization";
  }

  const base = `/admin/organizations/${membership.organizationId}`;

  if (role === APP_ROLE.ADMIN) {
    return base;
  }

  const roles = splitRoles(membership.role);
  const branchMemberships = await getUserBranchMembershipsForLogin(
    userId,
    membership.organizationId,
    membership.role,
  );
  const branchId = await resolveActiveBranchId(
    userId,
    membership.organizationId,
    null,
    membership.role,
  );

  if (branchId) {
    return `${base}/branches/${branchId}`;
  }

  if (branchMemberships.length > 1) {
    return buildBranchPickerPath(membership.organizationId);
  }

  if (roles.some((memberRole) => ECODIM_ORG_ROLES.has(memberRole))) {
    return `${base}/ecodim`;
  }

  if (roles.some((memberRole) => ORG_HOME_ROLES.has(memberRole))) {
    return base;
  }

  return base;
}
