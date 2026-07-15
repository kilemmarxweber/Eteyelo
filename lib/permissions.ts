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
  /** Propriétaire plateforme (root) : voit et gère toutes les organisations. */
  OWNER: "owner",
  /** Gestionnaire d'organisation (compte applicatif) : CRU sur son organisation. */
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
export function isPlatformOwnerRole(role: string | null | undefined): boolean {
  return role === APP_ROLE.OWNER;
}

export function isAppAdminRole(role: string | null | undefined): boolean {
  return role === APP_ROLE.ADMIN;
}

export function isPlatformSupportAppRole(
  role: string | null | undefined,
): boolean {
  return role === APP_ROLE.PLATFORM_SUPPORT;
}

/** Propriétaire plateforme ou gestionnaire d'organisation (compte applicatif). */
export function isOrganizationManagerAppRole(
  role: string | null | undefined,
): boolean {
  return isPlatformOwnerRole(role) || isAppAdminRole(role);
}

/** Admin plateforme ou agent support Klambocore (permissions élevées). */
export function hasPlatformSupportPrivileges(
  role: string | null | undefined,
): boolean {
  return (
    isPlatformOwnerRole(role) ||
    isAppAdminRole(role) ||
    isPlatformSupportAppRole(role)
  );
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

const orgAdminWithoutDelete: StatementShape = {
  ...organizationPluginAdminAc.statements,
  organization: ["update"],
  member: ["create", "read", "update"],
  invitation: ["create", "cancel"],
  team: ["create", "update"],
  ac: ["create", "read", "update"],
};

/** Gestionnaire org : CRU organisation + CRUD membres (pas de suppression d'organisation). */
const orgGestionnairePermissions: StatementShape = {
  ...organizationPluginAdminAc.statements,
  organization: ["update"],
  member: ["create", "read", "update", "delete"],
  invitation: ["create", "cancel"],
  team: ["create", "update"],
  ac: ["create", "read", "update"],
  schedule: ["create", "read", "update", "delete"],
  organizationSupport: ["create", "read", "update", "delete"],
  platformEscalation: ["read"],
};

/** Preset plugin Admin (`adminAc`) + même niveau organisation que `organization.adminAc`, plus domaine. */
export const applicationRoleStatements: Record<string, StatementShape> = {
  [APP_ROLE.OWNER]: {
    ...adminPluginAdminAc.statements,
    ...organizationPluginAdminAc.statements,
    organization: ["update", "delete"],
    schedule: ["create", "read", "update", "delete"],
    platformSupport: ["create", "read", "update", "delete"],
    organizationSupport: ["create", "read", "update", "delete"],
    platformEscalation: ["create", "read", "update", "assign", "close"],
  },
  [APP_ROLE.ADMIN]: {
    ...orgAdminWithoutDelete,
    schedule: ["create", "read", "update"],
    organizationSupport: ["create", "read", "update"],
    platformEscalation: ["read"],
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
  [ORG_ROLE.GESTIONNAIRE]: orgGestionnairePermissions,
  [ORG_ROLE.PARENT]: {
    ...organizationPluginMemberAc.statements,
    member: ["read"],
  },
  [ORG_ROLE.STUDENT]: {
    ...organizationPluginMemberAc.statements,
    member: ["read"],
  },
  [ORG_ROLE.TEACHER]: {
    ...organizationPluginMemberAc.statements,
    member: ["read"],
    schedule: ["read"],
  },
  [ORG_ROLE.MONITEUR]: {
    ...organizationPluginMemberAc.statements,
    member: ["read"],
    schedule: ["read"],
  },
  [ORG_ROLE.RESPONSABLE]: {
    ...organizationPluginMemberAc.statements,
    member: ["read"],
    schedule: ["read"],
  },
  [ORG_ROLE.SURVEILLANT]: {
    ...organizationPluginMemberAc.statements,
    member: ["read"],
  },
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

export const ORGANIZATION_ROLE_GROUPS = [
  {
    id: "management",
    label: "Gestion de l'organisation",
    description:
      "Gestion complete de l'organisation. Le gestionnaire peut tout faire sauf supprimer l'organisation.",
    slugs: [ORG_ROLE.OWNER, ORG_ROLE.GESTIONNAIRE],
  },
  {
    id: "branch",
    label: "Acces branche",
    description:
      "Acces limite a la branche assignee. Lecture seule sur les membres et l'organisation.",
    slugs: [
      ORG_ROLE.TEACHER,
      ORG_ROLE.PARENT,
      ORG_ROLE.STUDENT,
      ORG_ROLE.MONITEUR,
      ORG_ROLE.RESPONSABLE,
      ORG_ROLE.SURVEILLANT,
    ],
  },
  {
    id: "support",
    label: "Support etablissement",
    description: "Lecture des membres et branches, gestion des tickets support.",
    slugs: [ORG_ROLE.SUPPORT],
  },
] as const;

export { authAccessControl };
