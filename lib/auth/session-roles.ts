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
    ...splitSessionRoles(session?.member?.role),
    ...splitSessionRoles(session?.activeMember?.role),
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

  // Alias FR / legacy → slugs canoniques
  if (roles.has("proprietaire")) roles.add(APP_ROLE.OWNER);
  if (roles.has("gestionnaire") && !roles.has(ORG_ROLE.GESTIONNAIRE)) {
    roles.add(ORG_ROLE.GESTIONNAIRE);
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

const APP_MANAGER_ROLES = [APP_ROLE.OWNER, APP_ROLE.ADMIN] as const;

/** Rôles managers org/école — sans caissier (unit-00 §4 / unit-01). */
const ORG_MANAGER_ROLES = [
  ORG_ROLE.OWNER,
  ORG_ROLE.GESTIONNAIRE,
  ORG_ROLE.AGENT_BUREAU,
  ORG_ROLE.PREFET,
  ORG_ROLE.DIRECTEUR,
  ORG_ROLE.DIRECTEUR_ETUDES,
  ORG_ROLE.SUPERVISEUR,
] as const;

export function canManageOrganization(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return hasSessionRole(
    session,
    [...APP_MANAGER_ROLES, ...ORG_MANAGER_ROLES],
    ...extraRoles,
  );
}

/**
 * Chef d’établissement (`prefet` ↔ `directeur`) + superviseur.
 * Pas le directeur des études.
 */
export function isSchoolLeadershipRole(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return hasSessionRole(
    session,
    [ORG_ROLE.PREFET, ORG_ROLE.DIRECTEUR, ORG_ROLE.SUPERVISEUR],
    ...extraRoles,
  );
}

/** Directeur des études (pilotage pédagogique, sans finance). */
export function isDirecteurEtudesRole(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return hasSessionRole(session, [ORG_ROLE.DIRECTEUR_ETUDES], ...extraRoles);
}

/**
 * Finance (paiement, rapports caisse).
 * Gestion org + caissier. Chef d’établissement (préfet/directeur) exclu.
 */
export function canAccessFinanceArea(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return hasSessionRole(
    session,
    [
      ...APP_MANAGER_ROLES,
      ORG_ROLE.OWNER,
      ORG_ROLE.GESTIONNAIRE,
      ORG_ROLE.CAISSIER,
    ],
    ...extraRoles,
  );
}

/**
 * Catalogue des frais + situation financière / impayés (vue établissement).
 * Managers finance uniquement — le caissier encaisse sans ce pilotage.
 */
export function canAccessFinanceOversight(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return hasSessionRole(
    session,
    [...APP_MANAGER_ROLES, ORG_ROLE.OWNER, ORG_ROLE.GESTIONNAIRE],
    ...extraRoles,
  );
}

/**
 * Portée caisse : `null` = vue globale (managers finance),
 * sinon `userId` = uniquement les opérations de ce caissier.
 */
export function resolveCashierSelfScope(
  session: any,
  userId: string,
): string | null {
  if (
    hasSessionRole(session, [
      ...APP_MANAGER_ROLES,
      ORG_ROLE.OWNER,
      ORG_ROLE.GESTIONNAIRE,
    ])
  ) {
    return null;
  }
  return userId;
}

/**
 * Inscription, classes, utilisateurs (hors finance) — leadership + études + gestionnaire.
 * Nom canonique unit-00 : `canAccessPedagogyArea`.
 */
export function canAccessPedagogyArea(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return hasSessionRole(
    session,
    [
      ...APP_MANAGER_ROLES,
      ORG_ROLE.OWNER,
      ORG_ROLE.GESTIONNAIRE,
      ORG_ROLE.AGENT_BUREAU,
      ORG_ROLE.PREFET,
      ORG_ROLE.DIRECTEUR,
      ORG_ROLE.DIRECTEUR_ETUDES,
      ORG_ROLE.SUPERVISEUR,
    ],
    ...extraRoles,
  );
}

/**
 * Inscription élèves : school admin (pédagogie) + caissier.
 * Ne donne pas accès aux autres zones school_admin (classes, candidatures…).
 */
export function canAccessRegistrationArea(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return (
    canAccessPedagogyArea(session, ...extraRoles) ||
    hasSessionRole(
      session,
      [ORG_ROLE.CAISSIER, "CAISSIER", "ACCOUNTANT", "accountant"],
      ...extraRoles,
    )
  );
}

/** @deprecated Alias — préférer `canAccessPedagogyArea`. */
export const canAccessPedagogyAdminArea = canAccessPedagogyArea;

/**
 * Liste / fiche élèves (lecture).
 * School admin + caissier (encaissement / contexte famille) — sans CRUD pour le caissier.
 */
export function canAccessStudentDirectory(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return (
    canAccessPedagogyArea(session, ...extraRoles) ||
    hasSessionRole(
      session,
      [ORG_ROLE.CAISSIER, "CAISSIER", "ACCOUNTANT", "accountant"],
      ...extraRoles,
    )
  );
}

/**
 * CRUD personnel / parents (RH).
 * Directeur des études exclu — AC `personnel`/`parent`: read only.
 * Accès liste / lecture : `canAccessPedagogyArea` ou `canManageOrganization`.
 */
export function canManageHrDirectory(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return hasSessionRole(
    session,
    [
      ...APP_MANAGER_ROLES,
      ORG_ROLE.OWNER,
      ORG_ROLE.GESTIONNAIRE,
      ORG_ROLE.PREFET,
      ORG_ROLE.DIRECTEUR,
      ORG_ROLE.SUPERVISEUR,
    ],
    ...extraRoles,
  );
}

export const canManagePersonnelRecords = canManageHrDirectory;
export const canManageParentRecords = canManageHrDirectory;

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
    [APP_ROLE.OWNER, ORG_ROLE.OWNER, "proprietaire"],
    ...extraRoles,
  );
}

export const PERMANENT_DELETE_DENIED_MESSAGE =
  "Le gestionnaire ne peut pas supprimer une information. Archivez-la ou modifiez-la.";

/**
 * Suppression physique d'une information.
 * Le gestionnaire (org ou app) peut créer / modifier / archiver, jamais supprimer.
 */
export function canPermanentlyDeleteInformation(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  if (isOrganizationOwnerSession(session, ...extraRoles)) {
    return true;
  }

  if (
    hasSessionRole(
      session,
      [ORG_ROLE.GESTIONNAIRE, APP_ROLE.ADMIN],
      ...extraRoles,
    )
  ) {
    return false;
  }

  return canManageOrganization(session, ...extraRoles);
}

/**
 * Paramètres branche avancés (types de frais, taux, horaires, présences) :
 * owner plateforme, admin app, propriétaire org ou gestionnaire.
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
      "proprietaire",
    ],
    ...extraRoles,
  );
}

/**
 * Structure scolaire (périodes, année scolaire, domaines primaire) +
 * communication publique / calendrier :
 * managers org (dont propriétaire) + chef d’établissement (préfet/directeur).
 */
export function canAccessSchoolOpsSettings(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return (
    canAccessBranchOrgSettings(session, ...extraRoles) ||
    hasSessionRole(
      session,
      [
        APP_ROLE.OWNER,
        ORG_ROLE.OWNER,
        "proprietaire",
        ORG_ROLE.PREFET,
        ORG_ROLE.DIRECTEUR,
        "DIRECTOR",
        "director",
      ],
      ...extraRoles,
    )
  );
}

/**
 * Support établissement : ops école + caissier + enseignant + agents support.
 */
export function canAccessSupportSettings(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return (
    canAccessSchoolOpsSettings(session, ...extraRoles) ||
    hasSessionRole(
      session,
      [
        ORG_ROLE.CAISSIER,
        "CAISSIER",
        "ACCOUNTANT",
        "accountant",
        ORG_ROLE.TEACHER,
        "TEACHER",
        "teacher",
        ORG_ROLE.SUPPORT,
        "support",
      ],
      ...extraRoles,
    )
  );
}

/** Notifications dépôt-candidature : owner, propriétaire, gestionnaire, chef école, études. */
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
      ORG_ROLE.DIRECTEUR_ETUDES,
    ],
    ...extraRoles,
  );
}

/** Notifications inscription-élève : owner, propriétaire, gestionnaire, caissier, chef école. */
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
      ORG_ROLE.PREFET,
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
    canSeeInscriptionNotifications(session, ...extraRoles) ||
    canReviewAbsenceJustifications(session, ...extraRoles)
  );
}

/**
 * Absences et justifications : propriétaire, préfet, directeur, études.
 * Ce sont les rôles qui examinent le dossier.
 */
export function canReviewAbsenceJustifications(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return hasSessionRole(
    session,
    [
      APP_ROLE.OWNER,
      APP_ROLE.ADMIN,
      ORG_ROLE.OWNER,
      ORG_ROLE.PREFET,
      ORG_ROLE.DIRECTEUR,
      ORG_ROLE.DIRECTEUR_ETUDES,
    ],
    ...extraRoles,
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

/** Enseignement (horaire, notes saisie, présences) : managers (sans caissier) + teacher.
 * Ne pas utiliser pour Finance, Classes setup, Cours, Inscription, Affectations
 * → préférer `canAccessFinanceArea` / `canAccessPedagogyArea` (unit-06).
 */
export function canAccessTeachingArea(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return (
    canManageOrganization(session, ...extraRoles) ||
    hasSessionRole(session, [ORG_ROLE.TEACHER, "TEACHER"], ...extraRoles)
  );
}

/**
 * Fiche centrale / Fiches classe : managers + enseignant titulaire
 * (`teacherContext.isTitulaire` — unit-06 / TEACHER_TITULAIRE_ROLE).
 */
export function canAccessTitulaireFichesArea(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  if (canManageOrganization(session, ...extraRoles)) return true;
  return Boolean(session?.teacherContext?.isTitulaire);
}

/**
 * Horaire : managers + teacher (gestion).
 * Parent / élève n’accèdent plus à /schedule.
 */
export function canReadScheduleArea(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return (
    canManageOrganization(session, ...extraRoles) ||
    hasSessionRole(session, [ORG_ROLE.TEACHER, "TEACHER"], ...extraRoles)
  );
}

export const canAccessScheduleReadArea = canReadScheduleArea;

/**
 * Notes : managers + teacher (saisie), **sauf** agent de bureau.
 * Parent / élève n’accèdent plus à /notes via le menu Cursus.
 */
export function canAccessNotesReadArea(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  if (
    hasSessionRole(
      session,
      [ORG_ROLE.AGENT_BUREAU, "agent_bureau", "membre_bureau"],
      ...extraRoles,
    )
  ) {
    return false;
  }
  return (
    canManageOrganization(session, ...extraRoles) ||
    hasSessionRole(session, [ORG_ROLE.TEACHER, "TEACHER"], ...extraRoles)
  );
}

/** Résultats / cursus : managers (sans caissier) + teacher + parent + student. */
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

/** Devoirs en ligne : enseignant + élève (pas parent). */
export function canAccessDevoirsArea(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return (
    canManageOrganization(session, ...extraRoles) ||
    hasSessionRole(
      session,
      [ORG_ROLE.TEACHER, ORG_ROLE.STUDENT, "TEACHER", "STUDENT", "teacher", "student"],
      ...extraRoles,
    )
  );
}

/** Bibliothèque : managers org (sans caissier) + enseignant + élève (pas parent). */
export function canAccessLibraryArea(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return (
    isPlatformOwnerSession(session, ...extraRoles) ||
    hasSessionRole(
      session,
      [
        APP_ROLE.OWNER,
        APP_ROLE.ADMIN,
        ORG_ROLE.OWNER,
        ORG_ROLE.GESTIONNAIRE,
        ORG_ROLE.PREFET,
        ORG_ROLE.DIRECTEUR,
        ORG_ROLE.DIRECTEUR_ETUDES,
        ORG_ROLE.SUPERVISEUR,
        ORG_ROLE.TEACHER,
        ORG_ROLE.STUDENT,
        "ADMIN",
        "DIRECTOR",
        "TEACHER",
        "STUDENT",
        "teacher",
        "student",
      ],
      ...extraRoles,
    )
  );
}
