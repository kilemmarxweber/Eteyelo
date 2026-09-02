import { getOrganizationAccessRoleLabel } from "@/lib/auth/role-labels";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { APP_ROLE, ORG_ROLE } from "@/lib/permissions";
import { shouldHideSidebarHref } from "@/lib/branch-route-guard";
import { SIDEBAR_HREF_BRANCH_AREA } from "@/lib/auth/branch-area-permissions";
import {
  getClassDisplayLabel,
  isUniversiteBranch,
} from "@/lib/branch-capabilities";
import {
  getNavClassKeys,
  getNavPeopleKeys,
  getPeopleVariant,
} from "@/lib/people-variant";
import { usesTrainingLabels } from "@/lib/training-labels";
import { normalizeBranchType } from "@/lib/academic-structure";
import { isOrganizationOwnerSession } from "@/lib/auth/session-roles";
import type { SideLink } from "@/src/data/sidelinks";

export type NavigationContext = "platform" | "organization" | "branch";

const BRANCH_BASE_PATH_RE =
  /^\/admin\/organizations\/[^/]+\/branches\/[^/]+/;

export function resolveBranchBasePath(pathname: string) {
  return pathname.match(BRANCH_BASE_PATH_RE)?.[0];
}

export function resolveNavigationContext(pathname: string): NavigationContext {
  if (resolveBranchBasePath(pathname)) return "branch";
  if (pathname.match(/^\/admin\/organizations\/[^/]+/)) return "organization";
  return "platform";
}

type StaticMenuItem = {
  title: string;
  href: string;
  icon: string;
  roles: string[];
  sub?: StaticMenuItem[];
};

const PLATFORM_MENU_ROLES = [APP_ROLE.OWNER, APP_ROLE.PLATFORM_SUPPORT];

/** Propriétaires uniquement (sections owner) — pas gestionnaire/caissier. */
export const OWNER_ONLY_MENU_ROLES = [APP_ROLE.OWNER, ORG_ROLE.OWNER];

/** owner, gestionnaire (+ app admin) — sans leadership ni caissier. */
const ORG_MANAGER_ROLES = [
  APP_ROLE.ADMIN,
  ORG_ROLE.OWNER,
  ORG_ROLE.GESTIONNAIRE,
  "ADMIN",
  "admin",
];

/** préfet/directeur (chef école), directeur des études, superviseur (+ legacy DIRECTOR…). */
const ORG_LEADERSHIP_ROLES = [
  ORG_ROLE.PREFET,
  ORG_ROLE.DIRECTEUR,
  ORG_ROLE.DIRECTEUR_ETUDES,
  ORG_ROLE.SUPERVISEUR,
  "DIRECTOR",
  "director",
];

/** Managers + leadership — **sans** caissier (unit-00 / unit-03). */
const SCHOOL_ADMIN_ROLES = [
  ...PLATFORM_MENU_ROLES,
  ...ORG_MANAGER_ROLES,
  ...ORG_LEADERSHIP_ROLES,
];

/**
 * Finance : managers org + caissier.
 * Chef d’établissement (préfet/directeur) et directeur des études exclus.
 */
const FINANCE_ROLES = [
  ...PLATFORM_MENU_ROLES,
  ...ORG_MANAGER_ROLES,
  ORG_ROLE.CAISSIER,
  "CAISSIER",
  "ACCOUNTANT",
  "accountant",
];

/** Catalogue des frais + situation impayés — sans caissier. */
const FINANCE_OVERSIGHT_ROLES = [
  ...PLATFORM_MENU_ROLES,
  ...ORG_MANAGER_ROLES,
];

const TEACHER_ROLES = [ORG_ROLE.TEACHER, "TEACHER", "teacher"];

/** Paie : menu et gestion des mises à jour réservés au propriétaire. */
const PAYROLL_ROLES = OWNER_ONLY_MENU_ROLES;

const TEACHER_TITULAIRE_ROLE = "TEACHER_TITULAIRE";

const CAISSIER_ROLES = [
  ORG_ROLE.CAISSIER,
  "CAISSIER",
  "ACCOUNTANT",
  "accountant",
];

const STUDENT_ROLES = [ORG_ROLE.STUDENT, "STUDENT", "student"];
const PARENT_ROLES = [ORG_ROLE.PARENT, "PARENT", "parent"];

/** Lecture annuaire élèves : school admin + caissier. */
const STUDENT_DIRECTORY_ROLES = [...SCHOOL_ADMIN_ROLES, ...CAISSIER_ROLES];

/** Élève + parent — résultats (parent : fiches enfants + résultats uniquement). */
const CURSUS_READ_ROLES = [...STUDENT_ROLES, ...PARENT_ROLES];

/** Bibliothèque : school admin + enseignant + élève (sans caissier ni parent). */
const LIBRARY_ROLES = [
  ...SCHOOL_ADMIN_ROLES,
  ...TEACHER_ROLES,
  ...STUDENT_ROLES,
];

/** Setup cours / pondérations — school admin uniquement (enseignant = horaire dashboard). */
const COURSE_ROLES = [...SCHOOL_ADMIN_ROLES];

/** Présences (classes) : school admin uniquement — pas le menu enseignant. */
const PRESENCE_ROLES = [...SCHOOL_ADMIN_ROLES];

/** Pointage / rapport perso : staff école + enseignant + caissier (hors élève/parent/propriétaire). */
const MY_PRESENCE_ROLES = [
  APP_ROLE.ADMIN,
  ORG_ROLE.GESTIONNAIRE,
  ...ORG_LEADERSHIP_ROLES,
  ...TEACHER_ROLES,
  ...CAISSIER_ROLES,
  "ADMIN",
  "admin",
];

/** Notes : saisie admin/teacher (pas parent ni élève dans le menu Cursus). */
const NOTES_ROLES = [...SCHOOL_ADMIN_ROLES, ...TEACHER_ROLES];

const RESULTS_ROLES = [
  ...SCHOOL_ADMIN_ROLES,
  ...TEACHER_ROLES,
  ...CURSUS_READ_ROLES,
];

/** Devoirs en ligne : admin école + enseignant + élève (pas parent). */
const DEVOIRS_ROLES = [
  ...SCHOOL_ADMIN_ROLES,
  ...TEACHER_ROLES,
  ...STUDENT_ROLES,
];

/** Fiches classe : school admin + titulaire (pas élève). */
const FICHES_ROLES = [...SCHOOL_ADMIN_ROLES, TEACHER_TITULAIRE_ROLE];

const FICHE_CENTRALE_ROLES = [...SCHOOL_ADMIN_ROLES, TEACHER_TITULAIRE_ROLE];

const CURSUS_ROLES = Array.from(
  new Set([
    ...SCHOOL_ADMIN_ROLES,
    ...TEACHER_ROLES,
    ...CURSUS_READ_ROLES,
    TEACHER_TITULAIRE_ROLE,
  ]),
);

const staticSidebarMenu: StaticMenuItem[] = [
  {
    title: "dashboard",
    href: "/admin",
    icon: "dashboard",
    roles: ["*"],
  },
  {
    title: "myPresence",
    href: "/admin/ma-presence",
    icon: "attendance",
    roles: MY_PRESENCE_ROLES,
  },
  {
    title: "registration",
    href: "/admin/registration",
    icon: "inscriptions",
    // School admin + caissier (enregistrement élèves / encaissement lié).
    roles: [...SCHOOL_ADMIN_ROLES, ...CAISSIER_ROLES],
  },
  {
    title: "attendance",
    href: "/admin/attendance",
    icon: "attendance",
    roles: PRESENCE_ROLES,
  },
  {
    title: "candidatures",
    href: "/admin/candidatures",
    icon: "candidatures",
    roles: SCHOOL_ADMIN_ROLES,
  },
  {
    title: "users",
    href: "/admin/settings",
    icon: "users",
    // Enseignant : pas d’annuaire (accès via dashboard Horaire / Cursus).
    roles: [...SCHOOL_ADMIN_ROLES, ...CAISSIER_ROLES],
    sub: [
      {
        title: "student",
        href: "/admin/student",
        icon: "eleves",
        roles: STUDENT_DIRECTORY_ROLES,
      },
      {
        title: "staff",
        href: "/admin/personnel",
        icon: "personnels",
        roles: SCHOOL_ADMIN_ROLES,
      },
      {
        title: "teacher",
        href: "/admin/teacher",
        icon: "enseignants",
        roles: SCHOOL_ADMIN_ROLES,
      },
      {
        title: "parent",
        href: "/admin/parent",
        icon: "parents",
        roles: SCHOOL_ADMIN_ROLES,
      },
    ],
  },
  {
    // Setup enseignement (admin) — enseignant : Horaire via tableau de bord uniquement.
    title: "teaching",
    href: "#",
    icon: "enseignants",
    roles: SCHOOL_ADMIN_ROLES,
    sub: [
      {
        title: "courses",
        href: "/admin/cours",
        icon: "cours",
        roles: COURSE_ROLES,
      },
      {
        title: "ponderations",
        href: "/admin/coursPonderationOption",
        icon: "options",
        roles: COURSE_ROLES,
      },
      {
        title: "assignments",
        href: "/admin/teaching",
        icon: "affectations",
        roles: SCHOOL_ADMIN_ROLES,
      },
      {
        title: "vacation",
        href: "/admin/creneau",
        icon: "vacation",
        roles: SCHOOL_ADMIN_ROLES,
      },
      {
        // Gestion horaire admin — lecture élève/parent sous Cursus ; enseignant via dashboard.
        title: "schedule",
        href: "/admin/schedule",
        icon: "horaire",
        roles: SCHOOL_ADMIN_ROLES,
      },
    ],
  },
  {
    title: "classes",
    href: "#",
    icon: "classes",
    roles: SCHOOL_ADMIN_ROLES,
    sub: [
      {
        title: "sections",
        href: "/admin/section",
        icon: "sections",
        roles: SCHOOL_ADMIN_ROLES,
      },
      {
        title: "options",
        href: "/admin/option",
        icon: "options",
        roles: SCHOOL_ADMIN_ROLES,
      },
      {
        title: "programmes",
        href: "/admin/programmes",
        icon: "sections",
        roles: SCHOOL_ADMIN_ROLES,
      },
      {
        title: "modules",
        href: "/admin/modules",
        icon: "options",
        roles: SCHOOL_ADMIN_ROLES,
      },
      {
        title: "class",
        href: "/admin/classe",
        icon: "classe",
        roles: SCHOOL_ADMIN_ROLES,
      },
    ],
  },
  {
    title: "finance",
    href: "#",
    icon: "finance",
    roles: FINANCE_ROLES,
    sub: [
      {
        title: "fees",
        href: "/admin/frais",
        icon: "frais",
        roles: FINANCE_OVERSIGHT_ROLES,
      },
      {
        title: "payment",
        href: "/admin/paiement",
        icon: "paiement",
        roles: FINANCE_ROLES,
      },
      {
        title: "teacherPayroll",
        href: "/admin/paie-enseignants",
        icon: "finance",
        roles: PAYROLL_ROLES,
      },
      {
        title: "transactions",
        href: "/admin/transactions",
        icon: "paiement",
        roles: PAYROLL_ROLES,
      },
    ],
  },
  {
    title: "cursus",
    href: "#",
    icon: "cursus",
    roles: CURSUS_ROLES,
    sub: [
      {
        title: "results",
        href: "/admin/results",
        icon: "results",
        roles: RESULTS_ROLES,
      },
      {
        title: "homework",
        href: "/admin/devoirs",
        icon: "devoirs",
        roles: DEVOIRS_ROLES,
      },
      {
        title: "library",
        href: "/admin/bibliotheque",
        icon: "bibliotheque",
        roles: LIBRARY_ROLES,
      },
      {
        title: "grades",
        href: "/admin/notes",
        icon: "notes",
        roles: NOTES_ROLES,
      },
      {
        title: "centralSheet",
        href: "/admin/ficheCentrales",
        icon: "fiches",
        roles: FICHE_CENTRALE_ROLES,
      },
      {
        title: "sheets",
        href: "/admin/fiches",
        icon: "fiches",
        roles: FICHES_ROLES,
      },
      {
        title: "attestations",
        href: "/admin/attestations",
        icon: "results",
        roles: SCHOOL_ADMIN_ROLES,
      },
      {
        title: "certificates",
        href: "/admin/brevets",
        icon: "results",
        roles: SCHOOL_ADMIN_ROLES,
      },
      {
        title: "transcripts",
        href: "/admin/releves",
        icon: "results",
        roles: SCHOOL_ADMIN_ROLES,
      },
      {
        title: "finalists",
        href: "/admin/finalistes",
        icon: "fiches",
        roles: SCHOOL_ADMIN_ROLES,
      },
    ],
  },
  {
    title: "help",
    href: "/admin/help",
    icon: "cursus",
    roles: ["*"],
  },
  {
    title: "settings",
    href: "/admin/settings",
    icon: "settings",
    // Profil sûr pour tous ; sous-routes avancées gated ailleurs (unit-09).
    roles: ["*"],
  },
];

function splitRoleValues(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.flatMap(splitRoleValues)));
}

const ALWAYS_VISIBLE_BRANCH_HREFS = new Set([
  "/admin",
  "/admin/help",
  "/admin/ma-presence",
  "/admin/settings",
]);

function canSeeMenu(menu: StaticMenuItem, roles: string[]) {
  if (menu.roles.includes("*")) return true;
  return menu.roles.some((role) => roles.includes(role));
}

function isDacMappedHref(href: string) {
  return Object.prototype.hasOwnProperty.call(SIDEBAR_HREF_BRANCH_AREA, href);
}

function filterRolesForContext(roles: string[], context: NavigationContext) {
  if (context !== "branch") return roles;

  const isBranchUser =
    roles.includes(APP_ROLE.USER) &&
    !roles.some((role) => SCHOOL_ADMIN_ROLES.includes(role));

  if (!isBranchUser) return roles;

  return roles.filter((role) => !(PLATFORM_MENU_ROLES as readonly string[]).includes(role));
}

function resolveHref(href: string, branchBasePath?: string) {
  if (href === "#") return href;
  if (!branchBasePath) return href;
  if (href === "/admin") return branchBasePath;
  if (href.startsWith("/admin/"))
    return `${branchBasePath}${href.replace("/admin", "")}`;
  return href;
}

function mapMenuItem(
  item: StaticMenuItem,
  roles: string[],
  branchBasePath?: string,
  typebranch?: unknown,
  cycles?: unknown,
  hideHrefs?: Set<string>,
  /** true = hideHrefs vient de la matrice DAC (OrganizationRole). */
  dacReady?: boolean,
  /** Propriétaire org/branche : menus branche complets. */
  fullBranchAccess?: boolean,
  dacStrictMenu?: boolean,
): SideLink | null {
  const dacStrict = Boolean(
    dacReady && dacStrictMenu && branchBasePath && !fullBranchAccess,
  );

  const sub = item.sub
    ?.map((child) =>
      mapMenuItem(
        child,
        roles,
        branchBasePath,
        typebranch,
        cycles,
        hideHrefs,
        dacReady,
        fullBranchAccess,
        dacStrictMenu,
      ),
    )
    .filter(Boolean) as SideLink[] | undefined;

  if (item.sub?.length && !sub?.length) return null;

  if (dacStrict) {
    if (item.href === "#") {
      if (!sub?.length) return null;
    } else if (item.sub?.length) {
      // Groupe avec href réel (ex. /admin/settings) : visible si au moins un enfant l'est.
    } else if (ALWAYS_VISIBLE_BRANCH_HREFS.has(item.href)) {
      // Toujours visible (dashboard, aide, ma présence).
    } else if (!isDacMappedHref(item.href)) {
      return null;
    } else if (hideHrefs?.has(item.href)) {
      return null;
    }
  } else {
    const dacGated = isDacMappedHref(item.href);

    if (fullBranchAccess) {
      // Propriétaire org / branche : tous les menus de la branche active.
    } else if (dacGated && dacReady && hideHrefs) {
      if (hideHrefs.has(item.href)) return null;
    } else {
      if (!canSeeMenu(item, roles)) return null;
      if (hideHrefs?.has(item.href)) return null;
    }
  }

  if (shouldHideSidebarHref(item.href, cycles ?? typebranch)) {
    return null;
  }

  const resolvedTypebranch = normalizeBranchType(typebranch);
  let title = item.title;
  let href = item.href;

  if (item.title === "classes" && item.href === "#") {
    title = getNavClassKeys(getClassDisplayLabel(resolvedTypebranch)).plural;
  }

  if (item.href === "/admin/classe") {
    title = getNavClassKeys(getClassDisplayLabel(resolvedTypebranch)).singular;
  }

  if (item.href === "/admin/schoolYear") {
    title = isUniversiteBranch(resolvedTypebranch)
      ? "academicYear"
      : "schoolYear";
  }

  const peopleKeys = getNavPeopleKeys(resolvedTypebranch);

  if (item.href === "/admin/student") {
    title = peopleKeys.student;
  }

  if (item.href === "/admin/teacher") {
    title = peopleKeys.teacher;
  }

  if (usesTrainingLabels(resolvedTypebranch)) {
    const variant = getPeopleVariant(resolvedTypebranch);
    if (item.href === "/admin/programmes") {
      title = variant === "university" ? "faculties" : "programmes";
    }

    if (item.href === "/admin/modules") {
      title = variant === "university" ? "tracks" : "modules";
    }
  }

  return {
    title,
    href: resolveHref(href, branchBasePath),
    icon: item.icon,
    sub,
  } as SideLink;
}

export function getBetterAuthMenuRoles(session: any) {
  return unique([
    session?.user?.role,
    session?.organization?.role,
    session?.teacherContext?.isTitulaire ? TEACHER_TITULAIRE_ROLE : undefined,
    ...(session?.user?.roles?.map((role: any) => role?.codeRole) ?? []),
    ...(session?.user?.roles?.map((role: any) => role?.nameRole) ?? []),
  ]);
}

export function buildStaticSideLinks(
  session: any,
  pathname: string,
  typebranch?: unknown,
  cycles?: unknown,
  options?: {
    /** Masquer ces hrefs logiques `/admin/...` (ex. registration sans inscription:read). */
    hideHrefs?: string[];
    /** true quand hideHrefs est issu de la matrice OrganizationRole. */
    dacReady?: boolean;
    /** true = menu branche piloté uniquement par hideHrefs (DAC + octrois), sans rôles statiques. */
    dacStrictMenu?: boolean;
  },
): SideLink[] {
  const context = resolveNavigationContext(pathname);
  const fullBranchAccess = isOrganizationOwnerSession(session);
  const roles = filterRolesForContext(
    getBetterAuthMenuRoles(session),
    context,
  );
  const branchBasePath = resolveBranchBasePath(pathname);
  const resolvedTypebranch = typebranch ?? session?.branch?.typebranch;
  const resolvedCycles = cycles ?? resolvedTypebranch;
  const hide = new Set(options?.hideHrefs ?? []);
  const dacReady = Boolean(options?.dacReady);
  const dacStrictMenu = Boolean(options?.dacStrictMenu);

  return staticSidebarMenu
    .map((item) => {
      const dacTop = isDacMappedHref(item.href);
      if (
        hide.has(item.href) &&
        !fullBranchAccess &&
        !(dacReady && branchBasePath && dacTop)
      ) {
        return null;
      }
      return mapMenuItem(
        item,
        roles,
        branchBasePath,
        resolvedTypebranch,
        resolvedCycles,
        hide,
        dacReady,
        fullBranchAccess,
        dacStrictMenu,
      );
    })
    .filter(Boolean) as SideLink[];
}

export function getPrimaryRoleLabel(session: any) {
  const orgRole = session?.organization?.role;
  const appRole = session?.user?.role;
  const legacyRole = session?.user?.roles?.[0]?.nameRole;
  const typebranch = session?.branch?.typebranch;

  // APP_ROLE.OWNER et ORG_ROLE.OWNER partagent le slug "owner" :
  // on délègue aux helpers plutôt qu'à un Record avec clés en double.
  if (appRole || orgRole) {
    return getOrganizationAccessRoleLabel(appRole, orgRole, typebranch);
  }

  const legacyLabels: Record<string, string> = {
    ADMIN: "Administrateur",
    DIRECTOR: "Directeur",
    TEACHER: "Enseignant",
    ACCOUNTANT: "Comptable",
    STUDENT: "Élève",
    PARENT: "Parent",
  };

  if (legacyRole && legacyLabels[legacyRole]) {
    if (legacyRole === "STUDENT" && typebranch != null) {
      return orgRoleLabel(ORG_ROLE.STUDENT, { typebranch });
    }
    if (legacyRole === "TEACHER" && typebranch != null) {
      return orgRoleLabel(ORG_ROLE.TEACHER, { typebranch });
    }
    return legacyLabels[legacyRole];
  }

  if (typeof legacyRole === "string" && legacyRole.trim()) {
    return orgRoleLabel(legacyRole.trim().toLowerCase(), { typebranch });
  }

  return "Aucun rôle";
}
