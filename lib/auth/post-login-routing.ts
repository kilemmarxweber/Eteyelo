import { APP_ROLE, ORG_ROLE } from "@/lib/permissions";
import {
  BRANCH_LOGIN_ORG_ROLES,
  buildBranchPickerPath,
  buildGestionnaireLandingPath,
  isGestionnaireBranchLandingRole,
} from "@/lib/auth/user-branch-access";

/**
 * Leadership école + études / superviseur :
 * si une branche d’affectation est résolue → `/branches/{branchId}` ;
 * sinon fallback `/ecodim`.
 */
const ECODIM_ORG_ROLES = new Set<string>([
  ORG_ROLE.DIRECTEUR,
  ORG_ROLE.PREFET,
  ORG_ROLE.DIRECTEUR_ETUDES,
  ORG_ROLE.SUPERVISEUR,
]);

const ORG_HOME_ROLES = new Set<string>([ORG_ROLE.OWNER]);

/** Agents support établissement → espace tickets / escalades. */
const SUPPORT_ORG_ROLES = new Set<string>([ORG_ROLE.SUPPORT]);

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
  const isBranchLoginRole = roles.some((role) =>
    BRANCH_LOGIN_ORG_ROLES.has(role),
  );

  // Caissier / enseignant / parent / élève → toujours leur branche (ou picker).
  if (isBranchLoginRole) {
    if (input.branchId) {
      return `${base}/branches/${input.branchId}`;
    }
    if ((input.branchCount ?? 0) > 0) {
      return buildBranchPickerPath(input.organizationId);
    }
    return base;
  }

  // Gestionnaire → établissement(s) qu’il gère (1 branche ou liste).
  if (isGestionnaireBranchLandingRole(input.membershipRole)) {
    return buildGestionnaireLandingPath(input.organizationId, input.branchId);
  }

  // Propriétaire organisation : accueil org (pas le picker ni une branche).
  if (roles.some((role) => ORG_HOME_ROLES.has(role))) {
    return base;
  }

  if (input.branchId) {
    return `${base}/branches/${input.branchId}`;
  }

  if ((input.branchCount ?? 0) > 1) {
    return buildBranchPickerPath(input.organizationId);
  }

  if (roles.some((role) => ECODIM_ORG_ROLES.has(role))) {
    return `${base}/ecodim`;
  }

  if (roles.some((role) => SUPPORT_ORG_ROLES.has(role))) {
    return `${base}/support`;
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
