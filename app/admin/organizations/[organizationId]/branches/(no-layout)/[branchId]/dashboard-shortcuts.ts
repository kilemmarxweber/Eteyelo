import type { DashboardVariant } from "@/lib/auth/dashboard-variant";

type Translate = (key: string, values?: Record<string, string | number>) => string;

export type DashboardShortcut = {
  title: string;
  description: string;
  href: string;
  color: string;
  iconKey:
    | "users"
    | "school"
    | "book"
    | "currency"
    | "calendar"
    | "chart"
    | "attendance"
    | "notes"
    | "library"
    | "results";
  /** Totaux affichés sous la description (ex. carte Finance parent). */
  amounts?: {
    totalDue: number;
    totalRemaining: number;
    currency: string;
  };
};

function branchHref(
  organizationId: string,
  branchId: string,
  path: string,
) {
  const base = `/admin/organizations/${organizationId}/branches/${branchId}`;
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

type ShortcutContext = {
  organizationId: string;
  branchId: string;
  studentPluralLower: string;
  classLabelPlural: string;
  showFinance: boolean;
  /** Propriétaire : pas de cards « Mon pointage » / rapport perso. */
  showMyPresence?: boolean;
  studentProfileId?: string | null;
  parentFinance?: {
    totalDue: number;
    totalRemaining: number;
    currency: string;
    firstChildId: string | null;
  } | null;
};

function myPresenceShortcuts(
  href: (path: string) => string,
  t: Translate,
): DashboardShortcut[] {
  return [
    {
      title: t("shortcuts.myCheckIn"),
      description: t("shortcuts.myCheckInDesc"),
      href: href("/ma-presence"),
      color: "bg-teal-500",
      iconKey: "attendance",
    },
    {
      title: t("shortcuts.myAttendanceReport"),
      description: t("shortcuts.myAttendanceReportDesc"),
      href: href("/ma-presence"),
      color: "bg-emerald-500",
      iconKey: "chart",
    },
  ];
}

function withMyPresence(
  ctx: ShortcutContext,
  href: (path: string) => string,
  t: Translate,
  rest: DashboardShortcut[],
): DashboardShortcut[] {
  if (ctx.showMyPresence === false) return rest;
  return [...myPresenceShortcuts(href, t), ...rest];
}

export function getDashboardShortcuts(
  variant: DashboardVariant,
  ctx: ShortcutContext,
  t: Translate,
): DashboardShortcut[] {
  const href = (path: string) =>
    branchHref(ctx.organizationId, ctx.branchId, path);
  const students = ctx.studentPluralLower;
  const classes = ctx.classLabelPlural.toLowerCase();

  switch (variant) {
    case "directeur":
      return withMyPresence(ctx, href, t, [
        {
          title: t("shortcuts.registration"),
          description: t("shortcuts.enrollStudents", { students }),
          href: href("/registration"),
          color: "bg-blue-500",
          iconKey: "users",
        },
        {
          title: t("shortcuts.attendance"),
          description: t("shortcuts.attendanceToday"),
          href: href("/attendance"),
          color: "bg-emerald-500",
          iconKey: "attendance",
        },
        ...(ctx.showFinance
          ? [
              {
                title: t("shortcuts.finance"),
                description: t("shortcuts.feesAndPayments"),
                href: href("/paiement"),
                color: "bg-orange-500",
                iconKey: "currency" as const,
              },
            ]
          : []),
        {
          title: t("shortcuts.users"),
          description: t("shortcuts.managePeople", { students }),
          href: href("/student"),
          color: "bg-violet-500",
          iconKey: "users",
        },
      ]);

    case "directeur_etudes":
    case "prefet":
      return withMyPresence(ctx, href, t, [
        {
          title: t("shortcuts.registration"),
          description: t("shortcuts.enrollStudents", { students }),
          href: href("/registration"),
          color: "bg-blue-500",
          iconKey: "users",
        },
        {
          title: t("shortcuts.attendance"),
          description: t("shortcuts.attendanceFollow"),
          href: href("/attendance"),
          color: "bg-emerald-500",
          iconKey: "attendance",
        },
        {
          title: ctx.classLabelPlural,
          description: t("shortcuts.organizeClasses", { classes }),
          href: href("/classe"),
          color: "bg-green-500",
          iconKey: "school",
        },
        {
          title: t("shortcuts.cursus"),
          description: t("shortcuts.resultsAndGrades"),
          href: href("/results"),
          color: "bg-purple-500",
          iconKey: "results",
        },
      ]);

    case "teacher":
      return withMyPresence(ctx, href, t, [
        {
          title: t("shortcuts.grades"),
          description: t("shortcuts.enterGrades"),
          href: href("/notes"),
          color: "bg-purple-500",
          iconKey: "notes",
        },
        {
          title: t("shortcuts.attendance"),
          description: t("shortcuts.attendanceMyClasses"),
          href: href("/attendance"),
          color: "bg-emerald-500",
          iconKey: "attendance",
        },
        {
          title: t("shortcuts.schedule"),
          description: t("shortcuts.mySchedule"),
          href: href("/schedule"),
          color: "bg-blue-500",
          iconKey: "calendar",
        },
        {
          title: t("shortcuts.results"),
          description: t("shortcuts.classResults"),
          href: href("/results"),
          color: "bg-indigo-500",
          iconKey: "results",
        },
      ]);

    case "caissier":
      return withMyPresence(ctx, href, t, [
        {
          title: t("shortcuts.registration"),
          description: t("shortcuts.registerStudents", { students }),
          href: href("/registration"),
          color: "bg-blue-500",
          iconKey: "users",
        },
        {
          title: t("shortcuts.payment"),
          description: t("shortcuts.collectPayments"),
          href: href("/paiement"),
          color: "bg-emerald-500",
          iconKey: "currency",
        },
      ]);

    case "student": {
      const ficheHref = ctx.studentProfileId
        ? href(`/student/${ctx.studentProfileId}`)
        : href("/");
      return [
        {
          title: t("shortcuts.myFile"),
          description: t("shortcuts.myFileDesc"),
          href: ficheHref,
          color: "bg-violet-500",
          iconKey: "notes",
        },
        {
          title: t("shortcuts.results"),
          description: t("shortcuts.myResults"),
          href: href("/results"),
          color: "bg-indigo-500",
          iconKey: "results",
        },
        {
          title: t("shortcuts.homework"),
          description: t("shortcuts.weekendHomework"),
          href: href("/devoirs"),
          color: "bg-emerald-500",
          iconKey: "notes",
        },
        {
          title: t("shortcuts.library"),
          description: t("shortcuts.readingResources"),
          href: href("/bibliotheque"),
          color: "bg-amber-500",
          iconKey: "library",
        },
      ];
    }

    case "support":
      return [
        {
          title: t("shortcuts.orgSupport"),
          description: t("shortcuts.orgSupportDesc"),
          href: `/admin/organizations/${ctx.organizationId}/support`,
          color: "bg-blue-600",
          iconKey: "users",
        },
        {
          title: t("shortcuts.localContact"),
          description: t("shortcuts.localContactDesc"),
          href: href("/settings/support"),
          color: "bg-sky-500",
          iconKey: "book",
        },
      ];

    case "parent": {
      const financeHref = ctx.parentFinance?.firstChildId
        ? href(`/student/${ctx.parentFinance.firstChildId}`)
        : href("/");
      const financeCard: DashboardShortcut | null = ctx.showFinance
        ? {
            title: t("shortcuts.finance"),
            description: t("shortcuts.parentFinance"),
            href: financeHref,
            color: "bg-emerald-500",
            iconKey: "currency",
            amounts: {
              totalDue: ctx.parentFinance?.totalDue ?? 0,
              totalRemaining: ctx.parentFinance?.totalRemaining ?? 0,
              currency: ctx.parentFinance?.currency ?? "USD",
            },
          }
        : null;

      return [
        {
          title: t("shortcuts.results"),
          description: t("shortcuts.childrenResults"),
          href: href("/results"),
          color: "bg-indigo-500",
          iconKey: "results",
        },
        ...(financeCard ? [financeCard] : []),
      ];
    }

    case "minimal":
    default:
      return withMyPresence(ctx, href, t, [
        {
          title: t("shortcuts.help"),
          description: t("shortcuts.helpCenter"),
          href: href("/help"),
          color: "bg-slate-500",
          iconKey: "book",
        },
      ]);
  }
}

export function overviewDescriptionForVariant(
  variant: DashboardVariant,
  branchTypeLabel: string,
  isSchoolBranch: boolean,
  t: Translate,
): string {
  switch (variant) {
    case "directeur":
      return isSchoolBranch
        ? t("overview.school", { branchType: branchTypeLabel })
        : t("overview.center", { branchType: branchTypeLabel.toLowerCase() });
    case "directeur_etudes":
    case "prefet":
      return t("overview.pedagogy", { branchType: branchTypeLabel });
    case "teacher":
      return t("overview.teacher");
    case "caissier":
      return t("overview.cashier");
    case "student":
      return t("overview.student");
    case "parent":
      return t("overview.parent");
    case "support":
      return t("overview.support");
    default:
      return t("overview.default", { branchType: branchTypeLabel });
  }
}
