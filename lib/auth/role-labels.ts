import { APP_ROLE, ORG_ROLE } from "@/lib/permissions";
import { orgRoleLabel } from "@/lib/org-role-labels";

const APP_ROLE_LABEL: Record<string, string> = {
  [APP_ROLE.OWNER]: "Proprietaire plateforme",
  [APP_ROLE.ADMIN]: "Gestionnaire",
  [APP_ROLE.USER]: "Utilisateur",
  [APP_ROLE.PLATFORM_SUPPORT]: "Support plateforme",
};

export function getApplicationRoleLabel(
  appRole: string | null | undefined,
): string {
  const normalized = (appRole ?? "").trim().toLowerCase();
  return APP_ROLE_LABEL[normalized] ?? (normalized || "Utilisateur");
}

export function getOrganizationAccessRoleLabel(
  appRole: string | null | undefined,
  memberRole?: string | null,
): string {
  const normalizedAppRole = (appRole ?? "").trim().toLowerCase();

  if (normalizedAppRole === APP_ROLE.OWNER) {
    return APP_ROLE_LABEL[APP_ROLE.OWNER];
  }

  if (normalizedAppRole === APP_ROLE.ADMIN) {
    return APP_ROLE_LABEL[APP_ROLE.ADMIN];
  }

  const primaryMemberRole = (memberRole ?? "")
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean)[0];

  if (primaryMemberRole) {
    return orgRoleLabel(primaryMemberRole);
  }

  return getApplicationRoleLabel(appRole);
}

export function normalizeMemberRole(
  memberRole: string | null | undefined,
): string | null {
  const role = (memberRole ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)[0];

  return role ?? null;
}

export function isOrganizationOwnerMember(
  memberRole: string | null | undefined,
): boolean {
  return normalizeMemberRole(memberRole) === ORG_ROLE.OWNER;
}
