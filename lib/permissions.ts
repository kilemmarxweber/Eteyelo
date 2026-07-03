/**
 * Slugs de rôles, presets Better Auth (`adminAc`, `ownerAc`, …),
 * premières grilles métier pour les rôles d’organisation, et AC partagée pour `betterAuth`.
 */

import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc as adminPluginAdminAc,
  defaultStatements as adminPluginSchemaStatements,
  userAc as adminPluginUserAc,
} from "better-auth/plugins/admin/access";
import {
  adminAc as organizationPluginAdminAc,
  defaultStatements as organizationPluginSchemaStatements,
  ownerAc,
  memberAc as organizationPluginMemberAc,
} from "better-auth/plugins/organization/access";

export const APP_ROLE = {
  ADMIN: "admin",
  USER: "user",
  PLATFORM_SUPPORT: "platform_support",
} as const;
export const BRANCH_ROLE = {
  DIRECTEUR: "directeur",
  RESPONSABLE: "responsable",
  MONITEUR: "moniteur",
  ACCUEIL: "accueil",
} as const;
export function isAppAdminRole(role: string | null | undefined): boolean {
  return role === APP_ROLE.ADMIN;
}

export function isPlatformSupportAppRole(
  role: string | null | undefined,
): boolean {
  return role === APP_ROLE.PLATFORM_SUPPORT;
}

/** Admin plateforme ou agent support Klambocore (permissions élevées). */
export function hasPlatformSupportPrivileges(
  role: string | null | undefined,
): boolean {
  return isAppAdminRole(role) || isPlatformSupportAppRole(role);
}

export const ORG_ROLE = {
  OWNER: "owner",
  GESTIONNAIRE: "gestionnaire",
  PARENT: "parent",
  STUDENT: "student",
  TEACHER: "teacher",
  MONITEUR: "moniteur",
  RESPONSABLE: "responsable",
  SURVEILLANT: "surveillant",
  SUPPORT: "support",
} as const;

export const ALL_ORG_ROLE_SLUGS = [
  ORG_ROLE.OWNER,
  ORG_ROLE.GESTIONNAIRE,
  ORG_ROLE.PARENT,
  ORG_ROLE.STUDENT,
  ORG_ROLE.TEACHER,
  ORG_ROLE.MONITEUR,
  ORG_ROLE.RESPONSABLE,
  ORG_ROLE.SURVEILLANT,
  ORG_ROLE.SUPPORT,
] as const;

export const accessControlStatements = {
  ...adminPluginSchemaStatements,
  ...organizationPluginSchemaStatements,
  inscription: ["create", "share", "update", "delete"],
  member: ["create", "read", "update", "delete"],
  branch: ["create", "read", "update", "delete"],
  teacher: ["create", "read", "update", "delete"],
  parent: ["create", "read", "update", "delete"],
  personnel: ["create", "read", "update", "delete"],
  schedule: ["create", "read", "update", "delete"],
  platformSupport: ["create", "read", "update", "delete"],
  organizationSupport: ["create", "read", "update", "delete"],
  platformEscalation: ["create", "read", "update", "assign", "close"],
} as const;

type StatementShape = {
  [K in keyof typeof accessControlStatements]?: ReadonlyArray<
    (typeof accessControlStatements)[K][number]
  >;
};

/** Preset plugin Admin (`adminAc`) + même niveau organisation que `organization.adminAc`, plus domaine. */
export const applicationRoleStatements: Record<string, StatementShape> = {
  [APP_ROLE.ADMIN]: {
    ...adminPluginAdminAc.statements,
    ...organizationPluginAdminAc.statements,
    schedule: ["create", "read", "update", "delete"],
    platformSupport: ["create", "read", "update", "delete"],
    organizationSupport: ["create", "read", "update", "delete"],
    platformEscalation: ["create", "read", "update", "assign", "close"],
  },
  [APP_ROLE.PLATFORM_SUPPORT]: {
    ...organizationPluginAdminAc.statements,
    member: ["read"],
    branch: ["read"],
    platformSupport: ["read", "update"],
    organizationSupport: ["read"],
    platformEscalation: ["create", "read", "update", "assign", "close"],
  },
  [APP_ROLE.USER]: {
    ...adminPluginUserAc.statements,
  },
};

/** Preset `ownerAc` pour le créateur ; autres rôles = grille métier initiale partagée. */
export const organizationRoleStatements: Record<string, StatementShape> = {
  [ORG_ROLE.OWNER]: {
    ...ownerAc.statements,
    inscription: ["create", "share", "update", "delete"],
    schedule: ["create", "read", "update", "delete"],
    organizationSupport: ["create", "read", "update", "delete"],
    platformEscalation: ["read"],
  },
  [ORG_ROLE.GESTIONNAIRE]: {
    ...organizationPluginMemberAc.statements,
    ...organizationPluginAdminAc.statements,
    schedule: ["create", "read", "update", "delete"],
    organizationSupport: ["create", "read", "update", "delete"],
    platformEscalation: ["read"],
  },
  [ORG_ROLE.PARENT]: { ...organizationPluginMemberAc.statements },
  [ORG_ROLE.STUDENT]: { ...organizationPluginMemberAc.statements },
  [ORG_ROLE.TEACHER]: {
    ...organizationPluginMemberAc.statements,
    schedule: ["read"],
  },
  [ORG_ROLE.MONITEUR]: {
    ...organizationPluginMemberAc.statements,
    schedule: ["read"],
  },
  [ORG_ROLE.RESPONSABLE]: {
    ...organizationPluginMemberAc.statements,
    schedule: ["read"],
  },
  [ORG_ROLE.SURVEILLANT]: { ...organizationPluginMemberAc.statements },
  [ORG_ROLE.SUPPORT]: {
    ...organizationPluginMemberAc.statements,
    member: ["read"],
    branch: ["read"],
    organizationSupport: ["read"],
    platformEscalation: ["create", "read"],
  },
};

const authAccessControl = createAccessControl(accessControlStatements);

type NewPluginRoleArg = Parameters<typeof authAccessControl.newRole>[0];

function rolesFromStatements(defs: Record<string, StatementShape>) {
  return Object.fromEntries(
    Object.entries(defs).map(([role, statements]) => [
      role,
      authAccessControl.newRole(statements as NewPluginRoleArg),
    ]),
  );
}

/** Rôles plugin `admin` : `Record<slug, Role>` attendu par better-auth (`authorize` + `statements`). */
export const applicationRoles = rolesFromStatements(applicationRoleStatements);

/** Rôles plugin `organization` : même forme que `applicationRoles`. */
export const organizationRoles = rolesFromStatements(
  organizationRoleStatements,
);
type AccessStatements = Record<string, readonly (string | number)[]>;

const PERMISSION_GROUPS = Object.entries(
  accessControlStatements as AccessStatements,
).map(
  ([resource, actions]) =>
    [
      resource,
      actions.map(String), // ✅ FORCE string ici
    ] as const,
);
// format: "resource:action"
export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap(
  ([resource, actions]) => actions.map((action) => `${resource}:${action}`),
);
export const ORGANIZATION_ROLE_SLUGS = Object.keys(organizationRoles) as Array<
  keyof typeof organizationRoles
>;
export { authAccessControl };
