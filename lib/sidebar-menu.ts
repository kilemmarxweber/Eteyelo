import { APP_ROLE, ORG_ROLE } from "@/lib/permissions";
import type { SideLink } from "@/src/data/sidelinks";

type StaticMenuItem = {
  title: string;
  href: string;
  icon: string;
  roles: string[];
  sub?: StaticMenuItem[];
};

const ADMIN_ROLES = [
  APP_ROLE.ADMIN,
  ORG_ROLE.OWNER,
  ORG_ROLE.GESTIONNAIRE,
  "ADMIN",
  "DIRECTOR",
  "admin",
  "director",
];

const TEACHER_ROLES = [ORG_ROLE.TEACHER, "TEACHER", "teacher"];
const TEACHER_TITULAIRE_ROLE = "TEACHER_TITULAIRE";

const TEACHING_ROLES = [
  ...ADMIN_ROLES,
  ORG_ROLE.MONITEUR,
  ORG_ROLE.RESPONSABLE,
  ...TEACHER_ROLES,
];

const COURSE_ROLES = [...ADMIN_ROLES, ORG_ROLE.MONITEUR, ORG_ROLE.RESPONSABLE];

const FINANCE_ROLES = [
  ...ADMIN_ROLES,
  "ACCOUNTANT",
  "accountant",
  "CAISSIER",
  "caissier",
];

const STUDENT_ROLES = [
  ...ADMIN_ROLES,
  ORG_ROLE.PARENT,
  "PARENT",
  "parent",
  "STUDENT",
  "student",
];

const CURSUS_ROLES = Array.from(new Set([...STUDENT_ROLES, ...TEACHER_ROLES]));

const TITULAIRE_CURSUS_ROLES = [...STUDENT_ROLES, TEACHER_TITULAIRE_ROLE];

const TITULAIRE_TEACHER_ROLES = [TEACHER_TITULAIRE_ROLE];

const staticSidebarMenu: StaticMenuItem[] = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: "dashboard",
    roles: ["*"],
  },
  {
    title: "Utilisateurs",
    href: "/admin/settings",
    icon: "users",
    roles: [...ADMIN_ROLES, ...TEACHER_ROLES],
    sub: [
      {
        title: "Élève",
        href: "/admin/student",
        icon: "eleves",
        roles: ADMIN_ROLES,
      },
      {
        title: "Personnel",
        href: "/admin/personnel",
        icon: "personnels",
        roles: ADMIN_ROLES,
      },
      {
        title: "Enseignant",
        href: "/admin/teacher",
        icon: "enseignants",
        roles: [...ADMIN_ROLES, ...TEACHER_ROLES],
      },
      {
        title: "Parent",
        href: "/admin/parent",
        icon: "parents",
        roles: ADMIN_ROLES,
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
        title: "Affectations",
        href: "/admin/teaching",
        icon: "affectations",
        roles: ADMIN_ROLES,
      },
      {
        title: "Vacation",
        href: "/admin/creneau",
        icon: "vacation",
        roles: ADMIN_ROLES,
      },
      {
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
    roles: ADMIN_ROLES,
    sub: [
      {
        title: "Année scolaire",
        href: "/admin/schoolYear",
        icon: "schoolyear",
        roles: ADMIN_ROLES,
      },
      {
        title: "Sections",
        href: "/admin/section",
        icon: "sections",
        roles: ADMIN_ROLES,
      },
      {
        title: "Options",
        href: "/admin/option",
        icon: "options",
        roles: ADMIN_ROLES,
      },
      {
        title: "Classe",
        href: "/admin/classe",
        icon: "classe",
        roles: ADMIN_ROLES,
      },
      {
        title: "Inscriptions",
        href: "/admin/classEnrollment",
        icon: "inscriptions",
        roles: ADMIN_ROLES,
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
        roles: CURSUS_ROLES,
      },
      {
        title: "Notes",
        href: "/admin/notes",
        icon: "notes",
        roles: TEACHING_ROLES,
      },
      {
        title: "Fiche Centrale",
        href: "/admin/ficheCentrales",
        icon: "fiches",
        roles: TITULAIRE_TEACHER_ROLES,
      },
      {
        title: "Fiches",
        href: "/admin/fiches",
        icon: "fiches",
        roles: TITULAIRE_CURSUS_ROLES,
      },
    ],
  },
  {
    title: "Paramètres",
    href: "/admin/settings",
    icon: "settings",
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
  if (roles.some((role) => ADMIN_ROLES.includes(role))) return true;
  return menu.roles.some((role) => roles.includes(role));
}

function resolveBranchBasePath(pathname: string) {
  return pathname.match(/^\/admin\/organizations\/[^/]+\/branches\/[^/]+/)?.[0];
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
): SideLink | null {
  if (!canSeeMenu(item, roles)) return null;

  const sub = item.sub
    ?.map((child) => mapMenuItem(child, roles, branchBasePath))
    .filter(Boolean) as SideLink[] | undefined;

  if (item.sub?.length && !sub?.length) return null;

  return {
    title: item.title,
    href: resolveHref(item.href, branchBasePath),
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
): SideLink[] {
  const roles = getBetterAuthMenuRoles(session);
  const branchBasePath = resolveBranchBasePath(pathname);

  return staticSidebarMenu
    .map((item) => mapMenuItem(item, roles, branchBasePath))
    .filter(Boolean) as SideLink[];
}

export function getPrimaryRoleLabel(session: any) {
  const orgRole = session?.organization?.role;
  const appRole = session?.user?.role;
  const legacyRole = session?.user?.roles?.[0]?.nameRole;

  const labels: Record<string, string> = {
    [APP_ROLE.ADMIN]: "Administrateur",
    [APP_ROLE.USER]: "Utilisateur",
    [ORG_ROLE.OWNER]: "Propriétaire",
    [ORG_ROLE.GESTIONNAIRE]: "Gestionnaire",
    [ORG_ROLE.PARENT]: "Parent",
    [ORG_ROLE.STUDENT]: "Eleve",
    [ORG_ROLE.TEACHER]: "Enseignant",
    [ORG_ROLE.MONITEUR]: "Moniteur",
    [ORG_ROLE.RESPONSABLE]: "Responsable",
    [ORG_ROLE.SURVEILLANT]: "Surveillant",
    ADMIN: "Administrateur",
    DIRECTOR: "Directeur",
    TEACHER: "Enseignant",
    ACCOUNTANT: "Comptable",
    STUDENT: "Étudiant",
    PARENT: "Parent",
  };

  if (appRole === APP_ROLE.ADMIN) return labels[APP_ROLE.ADMIN];

  return labels[orgRole] ?? labels[appRole] ?? legacyRole ?? "Aucun rôle";
}
