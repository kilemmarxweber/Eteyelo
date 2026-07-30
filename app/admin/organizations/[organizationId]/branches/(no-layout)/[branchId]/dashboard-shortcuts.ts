import type { DashboardVariant } from "@/lib/auth/dashboard-variant";

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
  studentLabel: string;
  studentPluralLower: string;
  classLabelPlural: string;
  showFinance: boolean;
  /** Lien « Ma fiche » (profil élève). */
  studentProfileId?: string | null;
};

/** CTA dashboard alignés sur la matrice menus (unit-00 §3 / unit-03b). */
export function getDashboardShortcuts(
  variant: DashboardVariant,
  ctx: ShortcutContext,
): DashboardShortcut[] {
  const href = (path: string) =>
    branchHref(ctx.organizationId, ctx.branchId, path);

  switch (variant) {
    case "directeur":
      return [
        {
          title: "Inscription",
          description: `Inscrire des ${ctx.studentPluralLower}`,
          href: href("/registration"),
          color: "bg-blue-500",
          iconKey: "users",
        },
        {
          title: "Présences",
          description: "Suivre les présences du jour",
          href: href("/attendance"),
          color: "bg-emerald-500",
          iconKey: "attendance",
        },
        ...(ctx.showFinance
          ? [
              {
                title: "Finance",
                description: "Frais et paiements",
                href: href("/paiement"),
                color: "bg-orange-500",
                iconKey: "currency" as const,
              },
            ]
          : []),
        {
          title: "Utilisateurs",
          description: `Gérer les ${ctx.studentPluralLower} et le personnel`,
          href: href("/student"),
          color: "bg-violet-500",
          iconKey: "users",
        },
      ];

    case "directeur_etudes":
    case "prefet":
      return [
        {
          title: "Inscription",
          description: `Inscrire des ${ctx.studentPluralLower}`,
          href: href("/registration"),
          color: "bg-blue-500",
          iconKey: "users",
        },
        {
          title: "Présences",
          description: "Suivre les présences",
          href: href("/attendance"),
          color: "bg-emerald-500",
          iconKey: "attendance",
        },
        {
          title: ctx.classLabelPlural,
          description: `Organiser les ${ctx.classLabelPlural.toLowerCase()}`,
          href: href("/classe"),
          color: "bg-green-500",
          iconKey: "school",
        },
        {
          title: "Cursus",
          description: "Résultats et notes",
          href: href("/results"),
          color: "bg-purple-500",
          iconKey: "results",
        },
      ];

    case "teacher":
      return [
        {
          title: "Notes",
          description: "Saisir les notes de mes cours",
          href: href("/notes"),
          color: "bg-purple-500",
          iconKey: "notes",
        },
        {
          title: "Présences",
          description: "Présences de mes classes",
          href: href("/attendance"),
          color: "bg-emerald-500",
          iconKey: "attendance",
        },
        {
          title: "Horaire",
          description: "Mon emploi du temps",
          href: href("/schedule"),
          color: "bg-blue-500",
          iconKey: "calendar",
        },
        {
          title: "Résultats",
          description: "Résultats de mes classes",
          href: href("/results"),
          color: "bg-indigo-500",
          iconKey: "results",
        },
      ];

    case "caissier":
      return [
        {
          title: "Inscription",
          description: `Enregistrer des ${ctx.studentPluralLower}`,
          href: href("/registration"),
          color: "bg-blue-500",
          iconKey: "users",
        },
        {
          title: "Frais",
          description: "Consulter et gérer les frais",
          href: href("/frais"),
          color: "bg-orange-500",
          iconKey: "currency",
        },
        {
          title: "Paiement",
          description: "Encaisser et suivre les paiements",
          href: href("/paiement"),
          color: "bg-emerald-500",
          iconKey: "currency",
        },
      ];

    case "student": {
      const ficheHref = ctx.studentProfileId
        ? href(`/student/${ctx.studentProfileId}`)
        : href("/");
      return [
        {
          title: "Ma fiche",
          description: "Mon dossier et mes documents scolaires",
          href: ficheHref,
          color: "bg-violet-500",
          iconKey: "notes",
        },
        {
          title: "Résultats",
          description: "Mes résultats scolaires",
          href: href("/results"),
          color: "bg-indigo-500",
          iconKey: "results",
        },
        {
          title: "Devoirs",
          description: "Mes devoirs du weekend",
          href: href("/devoirs"),
          color: "bg-emerald-500",
          iconKey: "notes",
        },
        {
          title: "Bibliothèque",
          description: "Ressources en lecture",
          href: href("/bibliotheque"),
          color: "bg-amber-500",
          iconKey: "library",
        },
      ];
    }

    case "support":
      return [
        {
          title: "Support établissement",
          description: "Escalades et suivi des signalements",
          href: `/admin/organizations/${ctx.organizationId}/support`,
          color: "bg-blue-600",
          iconKey: "users",
        },
        {
          title: "Contact local",
          description: "Page support de la branche",
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
            title: "Finance",
            description: "Totaux des enfants (année en cours)",
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
          title: "Résultats",
          description: "Résultats des enfants",
          href: href("/results"),
          color: "bg-indigo-500",
          iconKey: "results",
        },
        {
          title: "Notes",
          description: "Notes (cours déjà notés)",
          href: href("/notes"),
          color: "bg-purple-500",
          iconKey: "notes",
        },
        {
          title: "Horaire",
          description: "Horaire annuel des enfants",
          href: href("/schedule"),
          color: "bg-blue-500",
          iconKey: "calendar",
        },
        ...(financeCard ? [financeCard] : []),
      ];
    }

    case "minimal":
    default:
      return [
        {
          title: "Aide",
          description: "Centre d'aide",
          href: href("/help"),
          color: "bg-slate-500",
          iconKey: "book",
        },
      ];
  }
}

export function overviewDescriptionForVariant(
  variant: DashboardVariant,
  branchTypeLabel: string,
  isSchoolBranch: boolean,
): string {
  switch (variant) {
    case "directeur":
      return isSchoolBranch
        ? `Pilotage pédagogique de votre établissement (${branchTypeLabel})`
        : `Pilotage de votre ${branchTypeLabel.toLowerCase()}`;
    case "directeur_etudes":
    case "prefet":
      return `Vue pédagogique — ${branchTypeLabel}`;
    case "teacher":
      return "Mon espace enseignant";
    case "caissier":
      return "Vue caisse — encaissements et impayés";
    case "student":
      return "Mon espace personnel";
    case "parent":
      return "Espace foyer — suivi des enfants";
    case "support":
      return "Espace support — signalements et escalades";
    default:
      return `Tableau de bord — ${branchTypeLabel}`;
  }
}
