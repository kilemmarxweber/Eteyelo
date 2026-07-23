"use client";

import Link from "next/link";
import {
  ArrowRight,
  ChartBar,
  Headphones,
  MailPlus,
  School,
  Users,
} from "lucide-react";

import { DeleteOrganizationButton } from "@/app/admin/organizations/components/delete-organization-dialog";
import { OrganizationRoleBadge } from "@/app/admin/organizations/components/organization-role-badge";
import { BackLink } from "@/components/ui/back-link";
import { cn } from "@/lib/utils";

const sections = [
  {
    title: "Établissements",
    description:
      "Gérer les établissements, campus ou antennes de l'organisation.",
    path: "branches",
    icon: School,
    countKey: "branches" as const,
    countLabel: (n: number) =>
      `${n} établissement${n > 1 ? "s" : ""}`,
    tone: {
      border: "border-sky-200/80 dark:border-sky-900/40",
      gradient: "bg-gradient-to-b from-sky-500/[0.08] via-card to-card",
      iconBox: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
      label: "text-sky-700/85 dark:text-sky-400",
      hover: "hover:border-sky-400/40 hover:shadow-sky-500/10",
    },
    ownerOnly: false,
  },
  {
    title: "Membres",
    description: "Créer des comptes, ajouter ou modifier les membres.",
    path: "members",
    icon: Users,
    countKey: "members" as const,
    countLabel: (n: number) => `${n} membre${n > 1 ? "s" : ""}`,
    tone: {
      border: "border-amber-200/80 dark:border-amber-900/40",
      gradient: "bg-gradient-to-b from-amber-500/[0.09] via-card to-card",
      iconBox: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
      label: "text-amber-800/85 dark:text-amber-400",
      hover: "hover:border-amber-400/40 hover:shadow-amber-500/10",
    },
    ownerOnly: false,
  },
  {
    title: "Invitations",
    description:
      "Activer et configurer les invitations (super administrateur).",
    path: "invitations",
    icon: MailPlus,
    countKey: null,
    countLabel: null,
    tone: {
      border: "border-teal-200/80 dark:border-teal-900/40",
      gradient: "bg-gradient-to-b from-teal-500/[0.08] via-card to-card",
      iconBox: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
      label: "text-teal-800/85 dark:text-teal-400",
      hover: "hover:border-teal-400/40 hover:shadow-teal-500/10",
    },
    ownerOnly: true,
  },
  {
    title: "Support établissement",
    description: "Gérer les agents internes et escalader vers Klambocore.",
    path: "support",
    icon: Headphones,
    countKey: null,
    countLabel: null,
    tone: {
      border: "border-emerald-200/80 dark:border-emerald-900/40",
      gradient: "bg-gradient-to-b from-emerald-500/[0.08] via-card to-card",
      iconBox: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
      label: "text-emerald-800/85 dark:text-emerald-400",
      hover: "hover:border-emerald-400/40 hover:shadow-emerald-500/10",
    },
    ownerOnly: false,
  },
  {
    title: "Rapports et statistiques",
    description: "Consulter les effectifs et indicateurs de l'organisation.",
    path: "rapport",
    icon: ChartBar,
    countKey: null,
    countLabel: null,
    tone: {
      border: "border-indigo-200/80 dark:border-indigo-900/40",
      gradient: "bg-gradient-to-b from-indigo-500/[0.08] via-card to-card",
      iconBox: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
      label: "text-indigo-700/85 dark:text-indigo-400",
      hover: "hover:border-indigo-400/40 hover:shadow-indigo-500/10",
    },
    ownerOnly: false,
  },
];

function orgInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export type OrganizationHomeViewProps = {
  organizationId: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  canDelete: boolean;
  /** Owner plateforme uniquement — lien vers /admin/organizations */
  canListAll: boolean;
  roleLabel: string | null;
  counts?: {
    branches: number;
    members: number;
  };
};

export function OrganizationHomeView({
  organizationId,
  organization: org,
  canDelete,
  canListAll,
  roleLabel,
  counts = { branches: 0, members: 0 },
}: OrganizationHomeViewProps) {
  const base = `/admin/organizations/${organizationId}`;

  return (
    <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 h-64 bg-[radial-gradient(ellipse_at_top,_oklch(0.72_0.12_250_/_0.16),_transparent_65%)]"
      />

      {canListAll ? (
        <BackLink href="/admin/organizations" label="Toutes les organisations" />
      ) : null}

      <section className="relative overflow-hidden rounded-[1.5rem] border border-primary/20 bg-gradient-to-b from-primary/[0.08] via-card to-card shadow-sm">
        <div
          aria-hidden
          className="absolute -right-10 -top-12 size-40 rounded-full bg-primary/10 blur-2xl"
        />
        <div
          aria-hidden
          className="h-1 w-full bg-gradient-to-r from-primary via-sky-500 to-emerald-400"
        />

        <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg font-bold tracking-wide text-primary-foreground shadow-md shadow-primary/20 ring-4 ring-primary/10">
              {orgInitials(org.name)}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex max-w-full items-center rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">
                  <span className="truncate">{org.slug}</span>
                </span>
                {roleLabel ? (
                  <OrganizationRoleBadge label={roleLabel} />
                ) : null}
              </div>

              <h1 className="mt-2 truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {org.name}
              </h1>

              <p className="mt-1.5 max-w-7xl text-sm leading-6 text-muted-foreground">
                Administrez les établissements, les membres et le support depuis
                cet espace.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-800 dark:text-sky-300">
                  <School className="size-3" />
                  {counts.branches} établissement
                  {counts.branches > 1 ? "s" : ""}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                  <Users className="size-3" />
                  {counts.members} membre{counts.members > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>

          {canDelete ? (
            <DeleteOrganizationButton
              organizationId={org.id}
              organizationName={org.name}
              variant="button"
            />
          ) : null}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {sections
          .filter((section) => !section.ownerOnly || canListAll)
          .map(({ icon: Icon, ...section }) => {
          const count =
            section.countKey != null ? counts[section.countKey] : null;

          return (
            <Link
              key={section.path}
              href={`${base}/${section.path}`}
              className={cn(
                "group relative flex flex-col gap-3 overflow-hidden rounded-2xl border p-4 shadow-sm transition duration-300",
                "hover:-translate-y-0.5 hover:shadow-md",
                section.tone.border,
                section.tone.gradient,
                section.tone.hover,
              )}
            >
              <span className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl transition duration-300 group-hover:scale-105",
                    section.tone.iconBox,
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <ArrowRight className="size-4 text-muted-foreground transition duration-300 group-hover:translate-x-1 group-hover:text-foreground" />
              </span>

              <span>
                <span
                  className={cn(
                    "mb-1 block text-[10px] font-bold uppercase tracking-[0.12em]",
                    section.tone.label,
                  )}
                >
                  Section
                </span>
                <span className="block text-base font-semibold text-foreground">
                  {section.title}
                </span>
                <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                  {section.description}
                </span>
                {count != null && section.countLabel ? (
                  <span className="mt-3 inline-flex rounded-full bg-background/70 px-2.5 py-1 text-[11px] font-semibold text-foreground ring-1 ring-border/70">
                    {section.countLabel(count)}
                  </span>
                ) : null}
              </span>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
