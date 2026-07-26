import { getOrganizationAccessRoleLabel } from "@/lib/auth/role-labels";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { APP_ROLE, ORG_ROLE } from "@/lib/permissions";
import { shouldHideSidebarHref } from "@/lib/branch-route-guard";
import { getClassDisplayLabelPlural, getClassDisplayLabel } from "@/lib/branch-capabilities";
import { getPeopleLabels } from "@/lib/people-labels";
import { getSchoolYearDisplayLabel } from "@/lib/university-lmd";
import { getTrainingLabels, usesTrainingLabels } from "@/lib/training-labels";
import { normalizeBranchType } from "@/lib/academic-structure";
import type { SideLink } from "@/src/data/sidelinks";

export type NavigationContext = "platform" | "organization" | "branch";

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
 * Finance : managers + chef d’établissement (préfet/directeur) + caissier.
 * Directeur des études / superviseur exclus.
 */
const FINANCE_ROLES = [
  ...PLATFORM_MENU_ROLES,
  ...ORG_MANAGER_ROLES,
  ORG_ROLE.PREFET,
  ORG_ROLE.DIRECTEUR,
  "DIRECTOR",
  "director",
  ORG_ROLE.CAISSIER,
  "CAISSIER",
  "ACCOUNTANT",
  "accountant",
];

const TEACHER_ROLES = [ORG_ROLE.TEACHER, "TEACHER", "teacher"];
const TEACHER_TITULAIRE_ROLE = "TEACHER_TITULAIRE";

const STUDENT_ROLES = [ORG_ROLE.STUDENT, "STUDENT", "student"];
const PARENT_ROLES = [ORG_ROLE.PARENT, "PARENT", "parent"];

/** Élève + parent — lecture cursus partagée (notes / horaire / résultats). */
const CURSUS_READ_ROLES = [...STUDENT_ROLES, ...PARENT_ROLES];

/** Bibliothèque : school admin + élève (sans caissier, teacher, parent). */
const LIBRARY_ROLES = [...SCHOOL_ADMIN_ROLES, ...STUDENT_ROLES];

const TEACHING_ROLES = [...SCHOOL_ADMIN_ROLES, ...TEACHER_ROLES];

/** Setup cours / pondérations — school admin uniquement (enseignant = horaire / notes). */
const COURSE_ROLES = [...SCHOOL_ADMIN_ROLES];

/** Présences : school admin + enseignant (ses classes — unit-06/10). */
const PRESENCE_ROLES = [...SCHOOL_ADMIN_ROLES, ...TEACHER_ROLES];

/** Notes : saisie (admin/teacher) + lecture élève/parent (unit-00 §3ter). */
const NOTES_ROLES = [
  ...SCHOOL_ADMIN_ROLES,
  ...TEACHER_ROLES,
  ...CURSUS_READ_ROLES,
];

const RESULTS_ROLES = [
  ...SCHOOL_ADMIN_ROLES,
  ...TEACHER_ROLES,
  ...CURSUS_READ_ROLES,
];

/** Fiches classe / perso : school admin, élève, titulaire — parent via profil enfant. */
const FICHES_ROLES = [
  ...SCHOOL_ADMIN_ROLES,
  ...STUDENT_ROLES,
  TEACHER_TITULAIRE_ROLE,
];

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
    title: "Dashboard",
    href: "/admin",
    icon: "dashboard",
    roles: ["*"],
  },
  {
    title: "Inscription",
    href: "/admin/registration",
    icon: "inscriptions",
    roles: SCHOOL_ADMIN_ROLES,
  },
  {
    title: "Presences",
    href: "/admin/attendance",
    icon: "attendance",
    roles: PRESENCE_ROLES,
  },
  {
    title: "Candidatures",
    href: "/admin/candidatures",
    icon: "candidatures",
    roles: SCHOOL_ADMIN_ROLES,
  },
  {
    title: "Utilisateurs",
    href: "/admin/settings",
    icon: "users",
    roles: [...SCHOOL_ADMIN_ROLES, ...TEACHER_ROLES],
    sub: [
      {
        title: "Élève",
        href: "/admin/student",
        icon: "eleves",
        roles: SCHOOL_ADMIN_ROLES,
      },
      {
        title: "Personnel",
        href: "/admin/personnel",
        icon: "personnels",
        roles: SCHOOL_ADMIN_ROLES,
      },
      {
        title: "Enseignant",
        href: "/admin/teacher",
        icon: "enseignants",
        roles: [...SCHOOL_ADMIN_ROLES, ...TEACHER_ROLES],
      },
      {
        title: "Parent",
        href: "/admin/parent",
        icon: "parents",
        roles: SCHOOL_ADMIN_ROLES,
      },
    ],
  },
  {
    title: "Enseignement",
    href: "#",
    icon: "enseignants",
    roles: TEACHING_ROLES,
    sub: [
      {
        title: "Cours",
        href: "/admin/cours",
        icon: "cours",
        roles: COURSE_ROLES,
      },
      {
        title: "Ponderations",
        href: "/admin/coursPonderationOption",
        icon: "options",
        roles: COURSE_ROLES,
      },
      {
        title: "Affectations",
        href: "/admin/teaching",
        icon: "affectations",
        roles: SCHOOL_ADMIN_ROLES,
      },
      {
        title: "Vacation",
        href: "/admin/creneau",
        icon: "vacation",
        roles: SCHOOL_ADMIN_ROLES,
      },
      {
        // Gestion horaire (admin / enseignant) — lecture élève/parent sous Cursus.
        title: "Horaire",
        href: "/admin/schedule",
        icon: "horaire",
        roles: TEACHING_ROLES,
      },
    ],
  },
  {
    title: "Classes",
    href: "#",
    icon: "classes",
    roles: SCHOOL_ADMIN_ROLES,
    sub: [
      {
        title: "Année scolaire",
        href: "/admin/schoolYear",
        icon: "schoolyear",
        roles: SCHOOL_ADMIN_ROLES,
      },
      {
        title: "Sections",
        href: "/admin/section",
        icon: "sections",
        roles: SCHOOL_ADMIN_ROLES,
      },
      {
        title: "Options",
        href: "/admin/option",
        icon: "options",
        roles: SCHOOL_ADMIN_ROLES,
      },
      {
        title: "Programmes",
        href: "/admin/programmes",
        icon: "sections",
        roles: SCHOOL_ADMIN_ROLES,
      },
      {
        title: "Modules",
        href: "/admin/modules",
        icon: "options",
        roles: SCHOOL_ADMIN_ROLES,
      },
      {
        title: "Classe",
        href: "/admin/classe",
        icon: "classe",
        roles: SCHOOL_ADMIN_ROLES,
      },
    ],
  },
  {
    title: "Finance",
    href: "#",
    icon: "finance",
    roles: FINANCE_ROLES,
    sub: [
      {
        title: "Frais",
        href: "/admin/frais",
        icon: "frais",
        roles: FINANCE_ROLES,
      },
      {
        title: "Paiement",
        href: "/admin/paiement",
        icon: "paiement",
        roles: FINANCE_ROLES,
      },
    ],
  },
  {
    title: "Cursus",
    href: "#",
    icon: "cursus",
    roles: CURSUS_ROLES,
    sub: [
      {
        title: "Résultats",
        href: "/admin/results",
        icon: "results",
        roles: RESULTS_ROLES,
      },
      {
        title: "Bibliothèque",
        href: "/admin/bibliotheque",
        icon: "bibliotheque",
        roles: LIBRARY_ROLES,
      },
      {
        title: "Notes",
        href: "/admin/notes",
        icon: "notes",
        roles: NOTES_ROLES,
      },
      {
        // Lecture horaire année (élève / parent) — unit-00 §3ter.
        title: "Horaire",
        href: "/admin/schedule",
        icon: "horaire",
        roles: CURSUS_READ_ROLES,
      },
      {
        title: "Fiche Centrale",
        href: "/admin/ficheCentrales",
        icon: "fiches",
        roles: FICHE_CENTRALE_ROLES,
      },
      {
        title: "Fiches",
        href: "/admin/fiches",
        icon: "fiches",
        roles: FICHES_ROLES,
      },
      {
        title: "Attestations",
        href: "/admin/attestations",
        icon: "results",
        roles: SCHOOL_ADMIN_ROLES,
      },
      {
        title: "Brevets",
        href: "/admin/brevets",
        icon: "results",
        roles: SCHOOL_ADMIN_ROLES,
      },
      {
        title: "Relevés de notes",
        href: "/admin/releves",
        icon: "results",
        roles: SCHOOL_ADMIN_ROLES,
      },
    ],
  },
  {
    title: "Aide",
    href: "/admin/help",
    icon: "cursus",
    roles: ["*"],
  },
  {
    title: "Paramètres",
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

function canSeeMenu(menu: StaticMenuItem, roles: string[]) {
  if (menu.roles.includes("*")) return true;
  return menu.roles.some((role) => roles.includes(role));
}

function resolveBranchBasePath(pathname: string) {
  return pathname.match(/^\/admin\/organizations\/[^/]+\/branches\/[^/]+/)?.[0];
}

export function resolveNavigationContext(pathname: string): NavigationContext {
  if (resolveBranchBasePath(pathname)) return "branch";
  if (pathname.match(/^\/admin\/organizations\/[^/]+/)) return "organization";
  return "platform";
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
): SideLink | null {
  if (!canSeeMenu(item, roles)) return null;

  if (shouldHideSidebarHref(item.href, typebranch)) {
    return null;
  }

  const sub = item.sub
    ?.map((child) => mapMenuItem(child, roles, branchBasePath, typebranch))
    .filter(Boolean) as SideLink[] | undefined;

  if (item.sub?.length && !sub?.length) return null;

  const resolvedTypebranch = normalizeBranchType(typebranch);
  let title = item.title;
  let href = item.href;

  if (item.title === "Classes" && item.href === "#") {
    title = getClassDisplayLabelPlural(resolvedTypebranch);
  }

  if (item.href === "/admin/classe") {
    title = getClassDisplayLabel(resolvedTypebranch);
  }

  if (item.href === "/admin/schoolYear") {
    title = getSchoolYearDisplayLabel(resolvedTypebranch);
  }

  const peopleLabels = getPeopleLabels(resolvedTypebranch);

  if (item.href === "/admin/student") {
    title = peopleLabels.student;
  }

  if (item.href === "/admin/teacher") {
    title = peopleLabels.teacher;
  }

  if (usesTrainingLabels(resolvedTypebranch)) {
    const labels = getTrainingLabels(resolvedTypebranch);

    if (item.href === "/admin/programmes") {
      title = labels.programmesMenu;
    }

    if (item.href === "/admin/modules") {
      title = labels.modulesMenu;
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
): SideLink[] {
  const context = resolveNavigationContext(pathname);
  const roles = filterRolesForContext(
    getBetterAuthMenuRoles(session),
    context,
  );
  const branchBasePath = resolveBranchBasePath(pathname);
  const resolvedTypebranch = typebranch ?? session?.branch?.typebranch;

  return staticSidebarMenu
    .map((item) => mapMenuItem(item, roles, branchBasePath, resolvedTypebranch))
    .filter(Boolean) as SideLink[];
}

export function getPrimaryRoleLabel(session: any) {
  const orgRole = session?.organization?.role;
  const appRole = session?.user?.role;
  const legacyRole = session?.user?.roles?.[0]?.nameRole;

  // APP_ROLE.OWNER et ORG_ROLE.OWNER partagent le slug "owner" :
  // on délègue aux helpers plutôt qu'à un Record avec clés en double.
  if (appRole || orgRole) {
    return getOrganizationAccessRoleLabel(appRole, orgRole);
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
    return legacyLabels[legacyRole];
  }

  if (typeof legacyRole === "string" && legacyRole.trim()) {
    return orgRoleLabel(legacyRole.trim().toLowerCase());
  }

  return "Aucun rôle";
}
