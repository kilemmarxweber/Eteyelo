import { APP_ROLE, ORG_ROLE } from "@/lib/permissions";

export function splitSessionRoles(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(splitSessionRoles);
  }

  if (typeof value !== "string") return [];

  return value
    .split(",")
    .map((role) =>
      role
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase(),
    )
    .filter(Boolean);
}

export function getSessionRoles(
  session: any,
  ...extraRoles: unknown[]
): Set<string> {
  const roles = new Set<string>([
    ...splitSessionRoles(session?.user?.role),
    ...splitSessionRoles(session?.organization?.role),
    ...extraRoles.flatMap(splitSessionRoles),
  ]);

  for (const role of session?.user?.roles ?? []) {
    if (typeof role === "string") {
      for (const value of splitSessionRoles(role)) {
        roles.add(value);
      }
      continue;
    }

    for (const value of [
      role?.role,
      role?.codeRole,
      role?.name,
      role?.nameRole,
    ]) {
      for (const normalizedRole of splitSessionRoles(value)) {
        roles.add(normalizedRole);
      }
    }
  }

  return roles;
}

export function hasSessionRole(
  session: any,
  expectedRoles: string[],
  ...extraRoles: unknown[]
): boolean {
  const roles = getSessionRoles(session, ...extraRoles);

  return expectedRoles.some((role) =>
    splitSessionRoles(role).some((normalizedRole) => roles.has(normalizedRole)),
  );
}

export function canManageOrganization(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return hasSessionRole(
    session,
    [
      APP_ROLE.OWNER,
      APP_ROLE.ADMIN,
      ORG_ROLE.OWNER,
      ORG_ROLE.GESTIONNAIRE,
      ORG_ROLE.PREFET,
      ORG_ROLE.DIRECTEUR,
      ORG_ROLE.SUPERVISEUR,
      ORG_ROLE.CAISSIER,
    ],
    ...extraRoles,
  );
}

/** Suppression physique d'organisation : owner plateforme uniquement. */
export function canDeleteOrganizationResource(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return hasSessionRole(session, [APP_ROLE.OWNER], ...extraRoles);
}

/** Propriétaire plateforme (`APP_ROLE.OWNER`) ou propriétaire d'organisation (`ORG_ROLE.OWNER`). */
export function isOrganizationOwnerSession(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return hasSessionRole(
    session,
    [APP_ROLE.OWNER, ORG_ROLE.OWNER],
    ...extraRoles,
  );
}

/**
 * Paramètres branche avancés (types de frais, calendrier, présences,
 * domaines primaire, support) : owner plateforme, admin app,
 * propriétaire org ou gestionnaire org.
 */
export function canAccessBranchOrgSettings(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return hasSessionRole(
    session,
    [
      APP_ROLE.OWNER,
      APP_ROLE.ADMIN,
      ORG_ROLE.OWNER,
      ORG_ROLE.GESTIONNAIRE,
    ],
    ...extraRoles,
  );
}

/** Notifications dépôt-candidature : owner, propriétaire, gestionnaire, préfet, directeur. */
export function canSeeCandidatureNotifications(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return hasSessionRole(
    session,
    [
      APP_ROLE.OWNER,
      APP_ROLE.ADMIN,
      ORG_ROLE.OWNER,
      ORG_ROLE.GESTIONNAIRE,
      ORG_ROLE.PREFET,
      ORG_ROLE.DIRECTEUR,
    ],
    ...extraRoles,
  );
}

/** Notifications inscription-élève : owner, propriétaire, gestionnaire, caissier, directeur. */
export function canSeeInscriptionNotifications(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return hasSessionRole(
    session,
    [
      APP_ROLE.OWNER,
      APP_ROLE.ADMIN,
      ORG_ROLE.OWNER,
      ORG_ROLE.GESTIONNAIRE,
      ORG_ROLE.CAISSIER,
      ORG_ROLE.DIRECTEUR,
    ],
    ...extraRoles,
  );
}

export function canSeeBranchNotifications(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return (
    canSeeCandidatureNotifications(session, ...extraRoles) ||
    canSeeInscriptionNotifications(session, ...extraRoles)
  );
}

export function isPlatformOwnerSession(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return hasSessionRole(session, [APP_ROLE.OWNER], ...extraRoles);
}

export function isOrganizationSupportRole(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return hasSessionRole(session, [ORG_ROLE.SUPPORT, "support"], ...extraRoles);
}

export function canAccessTeachingArea(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return (
    canManageOrganization(session, ...extraRoles) ||
    hasSessionRole(session, [ORG_ROLE.TEACHER, "TEACHER"], ...extraRoles)
  );
}

export function canReadScheduleArea(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return (
    canManageOrganization(session, ...extraRoles) ||
    hasSessionRole(
      session,
      [
        ORG_ROLE.TEACHER,
        ORG_ROLE.PREFET,
        ORG_ROLE.DIRECTEUR,
        ORG_ROLE.SUPERVISEUR,
        "TEACHER",
        "PREFET",
        "DIRECTEUR",
        "SUPERVISEUR",
      ],
      ...extraRoles,
    )
  );
}

export function canAccessResultsArea(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return (
    canManageOrganization(session, ...extraRoles) ||
    hasSessionRole(
      session,
      [
        ORG_ROLE.TEACHER,
        ORG_ROLE.PARENT,
        ORG_ROLE.STUDENT,
        "TEACHER",
        "PARENT",
        "STUDENT",
      ],
      ...extraRoles,
    )
  );
}
