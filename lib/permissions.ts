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
  /**
   * Chef d’établissement — alias secondaire/humanités de `directeur`.
   * Mêmes permissions (pédagogie + finance + RH).
   */
  PREFET: "prefet",
  /**
   * Chef d’établissement — alias primaire de `prefet`.
   * Mêmes permissions (pédagogie + finance + RH).
   */
  DIRECTEUR: "directeur",
  /**
   * Directeur des études : pilotage pédagogique (enseignants / enseignement),
   * sans finance ni CRUD RH personnel/parents.
   */
  DIRECTEUR_ETUDES: "directeur_etudes",
  TEACHER: "teacher",
  SUPERVISEUR: "superviseur",
  CAISSIER: "caissier",
  STUDENT: "student",
  PARENT: "parent",
  SUPPORT: "support",
} as const;

/** Chef d’établissement : `prefet` ↔ `directeur` (libellé selon type d’école). */
export const SCHOOL_HEAD_ORG_ROLES = [
  ORG_ROLE.PREFET,
  ORG_ROLE.DIRECTEUR,
] as const;

export const ALL_ORG_ROLE_SLUGS = [
  ORG_ROLE.OWNER,
  ORG_ROLE.GESTIONNAIRE,
  ORG_ROLE.PREFET,
  ORG_ROLE.DIRECTEUR,
  ORG_ROLE.DIRECTEUR_ETUDES,
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
  /** Annuaire élèves (CRUD / lecture scoped). */
  student: ["create", "read", "update", "delete"],
  /** Paiement, frais, caisse — `encaisser` = opération caisse (P8). */
  finance: ["create", "read", "update", "delete", "encaisser"],
  /** Affectations enseignement. */
  teaching: ["create", "read", "update", "delete", "assign"],
  attendance: ["create", "read", "update", "delete"],
  notes: ["create", "read", "update", "delete"],
  results: ["create", "read", "update", "delete"],
  devoirs: ["create", "read", "update", "delete"],
  library: ["create", "read", "update", "delete"],
  fiches: ["create", "read", "update", "delete"],
  documents: ["create", "read", "update", "delete"],
  settings: ["create", "read", "update", "delete"],
  candidatures: ["create", "read", "update", "delete"],
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

/** Modules scolaires hors RH « classique » (déclarés P1 — enforcement P6–P8). */
const SCHOOL_MODULE_RESOURCES = [
  "student",
  "teaching",
  "attendance",
  "notes",
  "results",
  "devoirs",
  "library",
  "fiches",
  "documents",
  "settings",
  "candidatures",
] as const;

/**
 * Actions métier (membres, branches, pédagogie, inscription) sans droits
 * d’administration org Better Auth (organization / invitation / team / ac).
 */
function withBusinessActions(actions: readonly CrudAction[]): StatementShape {
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

  return shape as StatementShape;
}

/**
 * Pack modules scolaires (hors `finance`, gérée à part selon le rôle).
 */
function withSchoolModuleActions(
  actions: readonly CrudAction[],
  options?: {
    includeTeachingAssign?: boolean;
    settingsActions?: readonly CrudAction[];
    omit?: ReadonlyArray<(typeof SCHOOL_MODULE_RESOURCES)[number]>;
  },
): StatementShape {
  const omit = new Set(options?.omit ?? []);
  const shape: Record<string, readonly string[]> = {};

  for (const resource of SCHOOL_MODULE_RESOURCES) {
    if (omit.has(resource)) continue;
    if (resource === "settings" && options?.settingsActions) {
      shape.settings = options.settingsActions;
      continue;
    }
    if (resource === "teaching" && options?.includeTeachingAssign) {
      shape.teaching = [...actions, "assign"];
      continue;
    }
    shape[resource] = actions;
  }

  return shape as StatementShape;
}

function withFinanceActions(
  actions: readonly CrudAction[],
  options?: { encaisser?: boolean },
): StatementShape {
  const finance = options?.encaisser === false ? [...actions] : [...actions, "encaisser" as const];
  return { finance } as StatementShape;
}

/**
 * Applique le même jeu d’actions CRUD sur les ressources métier org
 * et, quand applicable, sur les ressources Better Auth.
 */
function withActions(actions: readonly CrudAction[]): StatementShape {
  const actionSet = new Set(actions);
  const shape: Record<string, readonly string[]> = {
    ...withBusinessActions(actions),
  };

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

/** Preset `ownerAc` pour le créateur ; autres rôles = grille métier 1A + catalogue scolaire P1. */
export const organizationRoleStatements: Record<string, StatementShape> = {
  [ORG_ROLE.OWNER]: {
    ...ownerAc.statements,
    ...withActions(CRUD_ACTIONS),
    ...withSchoolModuleActions(CRUD_ACTIONS, { includeTeachingAssign: true }),
    ...withFinanceActions(CRUD_ACTIONS),
    // Propriétaire org : update/archive, pas de suppression physique (owner plateforme seul).
    organization: ["update"],
    organizationSupport: ["create", "read", "update", "delete"],
    platformEscalation: ["read"],
  },
  [ORG_ROLE.GESTIONNAIRE]: {
    // CRU : créer / lire / modifier / archiver. Jamais de suppression physique.
    ...withActions(CRU_ACTIONS),
    ...withSchoolModuleActions(CRU_ACTIONS, { includeTeachingAssign: true }),
    ...withFinanceActions(CRU_ACTIONS),
    organizationSupport: ["create", "read", "update"],
    platformEscalation: ["read"],
  },
  /**
   * Préfet / Directeur (chef d’établissement) : CRU métier branche + RH + pédagogie.
   * Sans droits d’admin org (archive / invitations / AC dynamique).
   * Sans finance (aligné `canAccessFinanceArea` — enforcement session jusqu’à P8).
   */
  [ORG_ROLE.PREFET]: {
    ...withBusinessActions(CRU_ACTIONS),
    ...withSchoolModuleActions(CRU_ACTIONS, { includeTeachingAssign: true }),
  },
  [ORG_ROLE.DIRECTEUR]: {
    ...withBusinessActions(CRU_ACTIONS),
    ...withSchoolModuleActions(CRU_ACTIONS, { includeTeachingAssign: true }),
  },
  /**
   * Directeur des études : CRU pédagogique (teacher / schedule / inscription / notes…).
   * `personnel` / `parent` en lecture seule — pas finance.
   * Settings partiel (ops scolaires lecture/update).
   */
  [ORG_ROLE.DIRECTEUR_ETUDES]: {
    ...withBusinessActions(CRU_ACTIONS),
    ...withSchoolModuleActions(CRU_ACTIONS, {
      includeTeachingAssign: true,
      settingsActions: ["read", "update"],
    }),
    personnel: ["read"],
    parent: ["read"],
  },
  [ORG_ROLE.TEACHER]: {
    ...organizationPluginMemberAc.statements,
    ...withActions(CREATE_READ_ACTIONS),
    student: ["read"],
    teaching: ["read", "assign"],
    attendance: ["create", "read", "update"],
    notes: ["create", "read", "update"],
    results: ["create", "read", "update"],
    devoirs: ["create", "read", "update"],
    library: ["create", "read", "update"],
    fiches: ["create", "read", "update"],
  },
  [ORG_ROLE.SUPERVISEUR]: {
    ...withActions(CRUD_ACTIONS),
    ...withSchoolModuleActions(CRUD_ACTIONS, { includeTeachingAssign: true }),
    ...withFinanceActions(CRUD_ACTIONS),
  },
  /**
   * Caissier : finance + inscription élèves (member:create pour comptes
   * parent/élève) + lecture annuaire. Pas de CRU sur schedule / personnel /
   * teacher / parent / branch.
   *
   * `finance` déclaré en P1 ; l’enforcement menus/actions bascule en P6–P8
   * (aujourd’hui encore helpers session).
   */
  [ORG_ROLE.CAISSIER]: {
    ...organizationPluginMemberAc.statements,
    member: ["create", "read"],
    inscription: ["create", "share", "update"],
    student: ["read"],
    finance: ["create", "read", "update", "encaisser"],
  },
  [ORG_ROLE.STUDENT]: {
    ...organizationPluginMemberAc.statements,
    ...withActions(READ_ACTIONS),
    student: ["read"],
    results: ["read"],
    devoirs: ["create", "read"],
    library: ["read"],
  },
  [ORG_ROLE.PARENT]: {
    ...organizationPluginMemberAc.statements,
    ...withActions(READ_ACTIONS),
    student: ["read"],
    results: ["read"],
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
      ORG_ROLE.DIRECTEUR_ETUDES,
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
