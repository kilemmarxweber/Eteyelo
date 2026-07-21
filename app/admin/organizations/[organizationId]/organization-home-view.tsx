"use client";

import Link from "next/link";
import {
  ArrowRight,
  ChartBar,
  Headphones,
  School,
  Users,
} from "lucide-react";

import { DeleteOrganizationButton } from "@/app/admin/organizations/components/delete-organization-dialog";
import { OrganizationRoleBadge } from "@/app/admin/organizations/components/organization-role-badge";
import { BackLink } from "@/components/ui/back-link";

const sections = [
  {
    title: "Etablissements",
    description:
      "Gerer les etablissements, campus ou antennes de l'organisation.",
    path: "branches",
    icon: School,
  },
  {
    title: "Membres",
    description: "Creer des comptes, ajouter ou modifier les membres.",
    path: "members",
    icon: Users,
  },
  {
    title: "Support etablissement",
    description: "Gerer les agents internes et escalader vers Klambocore.",
    path: "support",
    icon: Headphones,
  },
  {
    title: "Rapports et statistiques",
    description: "Consulter les effectifs et indicateurs de l'organisation.",
    path: "rapport",
    icon: ChartBar,
  },
];

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
};

export function OrganizationHomeView({
  organizationId,
  organization: org,
  canDelete,
  canListAll,
  roleLabel,
}: OrganizationHomeViewProps) {
  const base = `/admin/organizations/${organizationId}`;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      {canListAll ? (
        <BackLink href="/admin/organizations" label="Toutes les organisations" />
      ) : null}

      <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-lg shadow-primary/10 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <p className="break-all text-xs font-semibold uppercase tracking-wide text-primary-foreground/70">
                Slug - {org.slug}
              </p>
              {roleLabel ? (
                <OrganizationRoleBadge
                  label={roleLabel}
                  className="bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/15"
                />
              ) : null}
            </div>

            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              {org.name}
            </h2>

            <p className="mt-2 text-sm leading-6 text-primary-foreground/90">
              Utilisez les sections ci-dessous pour administrer cette
              organisation, ses etablissements et ses membres.
            </p>
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map(({ icon: Icon, ...section }) => (
          <Link
            key={section.path}
            href={`${base}/${section.path}`}
            className="group flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
          >
            <span className="flex items-start justify-between gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Icon className="size-4" />
              </span>
              <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground" />
            </span>

            <span>
              <span className="block text-base font-semibold text-foreground">
                {section.title}
              </span>
              <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                {section.description}
              </span>
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
