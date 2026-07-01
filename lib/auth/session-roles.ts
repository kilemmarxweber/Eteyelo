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
    [APP_ROLE.ADMIN, ORG_ROLE.OWNER, ORG_ROLE.GESTIONNAIRE],
    ...extraRoles,
  );
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
        ORG_ROLE.MONITEUR,
        ORG_ROLE.RESPONSABLE,
        "TEACHER",
        "MONITEUR",
        "RESPONSABLE",
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
