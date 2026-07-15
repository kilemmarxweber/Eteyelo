/**
 * Slugs de rôles, presets Better Auth (`adminAc`, `ownerAc`, …),
 * grilles métier pour les rôles d’organisation, et AC partagée pour `betterAuth`.
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
  PREFET: "prefet",
  DIRECTEUR: "directeur",
  TEACHER: "teacher",
  SUPERVISEUR: "superviseur",
  CAISSIER: "caissier",
  STUDENT: "student",
  PARENT: "parent",
  SUPPORT: "support",
} as const;

export const ALL_ORG_ROLE_SLUGS = [
  ORG_ROLE.OWNER,
  ORG_ROLE.GESTIONNAIRE,
  ORG_ROLE.PREFET,
  ORG_ROLE.DIRECTEUR,
  ORG_ROLE.TEACHER,
  ORG_ROLE.SUPERVISEUR,
  ORG_ROLE.CAISSIER,
  ORG_ROLE.STUDENT,
  ORG_ROLE.PARENT,
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

type CrudAction = "create" | "read" | "update" | "delete";

const ORG_BUSINESS_RESOURCES = [
  "member",
  "branch",
  "teacher",
  "parent",
  "personnel",
  "schedule",
] as const;

/**
 * Applique le même jeu d’actions CRUD sur les ressources métier org
 * et, quand applicable, sur les ressources Better Auth.
 */
function withActions(actions: readonly CrudAction[]): StatementShape {
  const actionSet = new Set(actions);
  const shape: Record<string, readonly string[]> = {};

  for (const resource of ORG_BUSINESS_RESOURCES) {
    shape[resource] = actions;
  }

  const inscriptionActions: Array<"create" | "share" | "update" | "delete"> =
    [];
  if (actionSet.has("create")) inscriptionActions.push("create");
  if (actionSet.has("read")) inscriptionActions.push("share");
  if (actionSet.has("update")) inscriptionActions.push("update");
  if (actionSet.has("delete")) inscriptionActions.push("delete");
  if (inscriptionActions.length > 0) {
    shape.inscription = inscriptionActions;
  }

  // Hard-delete d'organisation = APP_ROLE.OWNER uniquement (hors withActions).
  // Les rôles org peuvent update (ex. archiver via l'app) mais jamais organization:delete.
  const organizationActions: Array<"update"> = [];
  if (actionSet.has("update")) organizationActions.push("update");
  if (organizationActions.length > 0) {
    shape.organization = organizationActions;
  }

  if (actionSet.has("create") || actionSet.has("delete")) {
    const invitationActions: Array<"create" | "cancel"> = [];
    if (actionSet.has("create")) invitationActions.push("create");
    invitationActions.push("cancel");
    shape.invitation = invitationActions;
  }

  const teamActions: Array<"create" | "update" | "delete"> = [];
  if (actionSet.has("create")) teamActions.push("create");
  if (actionSet.has("update")) teamActions.push("update");
  if (actionSet.has("delete")) teamActions.push("delete");
  if (teamActions.length > 0) {
    shape.team = teamActions;
  }

  const acActions = actions.filter((action) =>
    (["create", "read", "update", "delete"] as const).includes(action),
  );
  if (acActions.length > 0) {
    shape.ac = acActions;
  }

  return shape as StatementShape;
}

const CRU_ACTIONS = ["create", "read", "update"] as const;
const CRUD_ACTIONS = ["create", "read", "update", "delete"] as const;
const CREATE_READ_ACTIONS = ["create", "read"] as const;
const READ_ACTIONS = ["read"] as const;

const orgAdminWithoutDelete: StatementShape = {
  ...organizationPluginAdminAc.statements,
  organization: ["update"],
  member: ["create", "read", "update"],
  invitation: ["create", "cancel"],
  team: ["create", "update"],
  ac: ["create", "read", "update"],
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

/** Preset `ownerAc` pour le créateur ; autres rôles = grille métier 1A. */
export const organizationRoleStatements: Record<string, StatementShape> = {
  [ORG_ROLE.OWNER]: {
    ...ownerAc.statements,
    ...withActions(CRUD_ACTIONS),
    // Propriétaire org : update/archive, pas de suppression physique (owner plateforme seul).
    organization: ["update"],
    organizationSupport: ["create", "read", "update", "delete"],
    platformEscalation: ["read"],
  },
  [ORG_ROLE.GESTIONNAIRE]: {
    ...withActions(CRU_ACTIONS),
    organizationSupport: ["create", "read", "update"],
    platformEscalation: ["read"],
  },
  [ORG_ROLE.PREFET]: {
    ...withActions(CRU_ACTIONS),
  },
  [ORG_ROLE.DIRECTEUR]: {
    ...withActions(CRU_ACTIONS),
  },
  [ORG_ROLE.TEACHER]: {
    ...organizationPluginMemberAc.statements,
    ...withActions(CREATE_READ_ACTIONS),
  },
  [ORG_ROLE.SUPERVISEUR]: {
    ...withActions(CRUD_ACTIONS),
  },
  [ORG_ROLE.CAISSIER]: {
    ...organizationPluginMemberAc.statements,
    ...withActions(CRU_ACTIONS),
  },
  [ORG_ROLE.STUDENT]: {
    ...organizationPluginMemberAc.statements,
    ...withActions(READ_ACTIONS),
  },
  [ORG_ROLE.PARENT]: {
    ...organizationPluginMemberAc.statements,
    ...withActions(READ_ACTIONS),
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
export const ORGANIZATION_ROLE_SLUGS = Object.keys(
  organizationRoles,
) as string[];

export const ORGANIZATION_ROLE_GROUPS = [
  {
    id: "management",
    label: "Gestion de l'organisation",
    description:
      "Gestion complete de l'organisation. Seul le owner plateforme peut supprimer une organisation ; le proprietaire peut l'archiver.",
    slugs: [
      ORG_ROLE.OWNER,
      ORG_ROLE.GESTIONNAIRE,
      ORG_ROLE.PREFET,
      ORG_ROLE.DIRECTEUR,
      ORG_ROLE.SUPERVISEUR,
    ],
  },
  {
    id: "branch",
    label: "Acces branche",
    description:
      "Acces limite a la branche assignee. Lecture ou creation selon le role.",
    slugs: [
      ORG_ROLE.TEACHER,
      ORG_ROLE.CAISSIER,
      ORG_ROLE.PARENT,
      ORG_ROLE.STUDENT,
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
