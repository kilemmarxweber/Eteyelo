import { APP_ROLE, ORG_ROLE } from "@/lib/permissions";
import { isBranchOwnerSession } from "@/lib/auth/branch-role-access";

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
  if (isBranchOwnerSession(session, ...extraRoles)) return true;
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

/** CRUD enseignants (ajout / édition / archivage) — pas le directeur des études. */
export function canManageTeachers(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  if (isBranchOwnerSession(session, ...extraRoles)) return true;
  if (isDirecteurEtudesRole(session, ...extraRoles)) return false;
  return canManageOrganization(session, ...extraRoles);
}

/** Notifications d'impact paie enseignant — propriétaires uniquement (pas chefs d’établissement). */
export function canSeePayrollImpactNotifications(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  const roles = getSessionRoles(session, ...extraRoles);

  if (
    roles.has(APP_ROLE.OWNER) ||
    roles.has(ORG_ROLE.OWNER) ||
    roles.has("proprietaire") ||
    roles.has(APP_ROLE.ADMIN)
  ) {
    return true;
  }

  const isSchoolLead =
    roles.has(ORG_ROLE.PREFET) ||
    roles.has(ORG_ROLE.DIRECTEUR) ||
    roles.has(ORG_ROLE.DIRECTEUR_ETUDES);

  if (isBranchOwnerSession(session, ...extraRoles) && !isSchoolLead) {
    return true;
  }

  return false;
}

/**
 * Finance (paiement, rapports caisse).
 * Gestion org + caissier. Chef d’établissement (préfet/directeur) exclu.
 */
export function canAccessFinanceArea(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  if (isBranchOwnerSession(session, ...extraRoles)) return true;
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
  if (isBranchOwnerSession(session, ...extraRoles)) return true;
  return hasSessionRole(
    session,
    [...APP_MANAGER_ROLES, ORG_ROLE.OWNER, ORG_ROLE.GESTIONNAIRE],
    ...extraRoles,
  );
}

/** Paie enseignants : lecture pour direction, caisse et enseignant. */
export function canAccessPayrollArea(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return isOrganizationOwnerSession(session, ...extraRoles);
}

export function canComputePayroll(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return isOrganizationOwnerSession(session, ...extraRoles);
}

export function canValidatePayroll(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return isOrganizationOwnerSession(session, ...extraRoles);
}

export function canPayPayroll(session: any, ...extraRoles: unknown[]): boolean {
  return isOrganizationOwnerSession(session, ...extraRoles);
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
 * Inscription élèves : gestionnaire, agent bureau, superviseur, caissier, owner.
 * Préfet / directeur / directeur des études exclus (octroi temporaire ou matrice explicite).
 */
export function canAccessRegistrationArea(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  if (isOrganizationOwnerSession(session, ...extraRoles)) return true;

  return hasSessionRole(
    session,
    [
      ...APP_MANAGER_ROLES,
      ORG_ROLE.OWNER,
      ORG_ROLE.GESTIONNAIRE,
      ORG_ROLE.AGENT_BUREAU,
      ORG_ROLE.SUPERVISEUR,
      ORG_ROLE.CAISSIER,
      "CAISSIER",
      "ACCOUNTANT",
      "accountant",
    ],
    ...extraRoles,
  );
}

/**
 * Candidatures (recrutement) : gestionnaire, superviseur, owner.
 * Préfet / directeur / directeur des études exclus par défaut.
 */
export function canAccessCandidaturesArea(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  if (isOrganizationOwnerSession(session, ...extraRoles)) return true;

  return hasSessionRole(
    session,
    [
      ...APP_MANAGER_ROLES,
      ORG_ROLE.OWNER,
      ORG_ROLE.GESTIONNAIRE,
      ORG_ROLE.SUPERVISEUR,
    ],
    ...extraRoles,
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

/** Propriétaire plateforme, propriétaire d'organisation ou admin de branche — accès complet menus/zones branche. */
export function isOrganizationOwnerSession(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  if (isBranchOwnerSession(session, ...extraRoles)) return true;
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
  if (isBranchOwnerSession(session, ...extraRoles)) return true;
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
 * Paramètres direction par défaut : calendrier scolaire, communication
 * publique, périodes. Propriétaire / gestionnaire + préfet / directeur /
 * directeur des études.
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
        ORG_ROLE.DIRECTEUR_ETUDES,
        "DIRECTOR",
        "director",
      ],
      ...extraRoles,
    )
  );
}

/**
 * Structure scolaire avancée (année, fusion, domaines primaire) :
 * propriétaire / gestionnaire uniquement — pas le directeur par défaut.
 */
export function canAccessSchoolStructureSettings(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return canAccessBranchOrgSettings(session, ...extraRoles);
}

/**
 * Support établissement : propriétaire / gestionnaire + caissier +
 * enseignant + agents support. Directeur / études exclus par défaut.
 */
export function canAccessSupportSettings(
  session: any,
  ...extraRoles: unknown[]
): boolean {
  return (
    canAccessBranchOrgSettings(session, ...extraRoles) ||
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

/** Notifications dépôt-candidature : owner, gestionnaire (pas chef école / études par défaut). */
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
    ],
    ...extraRoles,
  );
}

/** Notifications inscription-élève : owner, gestionnaire, caissier (pas chef école par défaut). */
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
  if (isBranchOwnerSession(session, ...extraRoles)) return true;
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
