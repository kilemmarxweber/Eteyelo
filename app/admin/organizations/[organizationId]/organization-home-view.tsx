"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  ChartBar,
  Handshake,
  Headphones,
  School,
  Shield,
  Users,
} from "lucide-react";

import { DeleteOrganizationButton } from "@/app/admin/organizations/components/delete-organization-dialog";
import { OrganizationRoleBadge } from "@/app/admin/organizations/components/organization-role-badge";
import { BackLink } from "@/components/ui/back-link";
import { useOrganizationById } from "@/lib/hooks/use-organizations-access";

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
    title: "Roles & permissions",
    description: "Configurer les roles metier et les droits associes.",
    path: "roles",
    icon: Shield,
  },
  {
    title: "Support etablissement",
    description: "Gerer les agents internes et escalader vers Klambocore.",
    path: "support",
    icon: Headphones,
  },
  {
    title: "Rapports et statistiques",
    description: "Gerer les parents, tuteurs et responsables legaux.",
    path: "rapport",
    icon: ChartBar,
  },
  {
    title: "Partenaires",
    description: "Creer, afficher et gerer les partenaires de l'organisation.",
    path: "partenaires",
    icon: Handshake,
  },
];

export function OrganizationHomeView() {
  const params = useParams();
  const id = params.organizationId as string;

  const {
    organization: org,
    canDelete,
    roleLabel,
    isPending,
  } = useOrganizationById(id);

  const base = `/admin/organizations/${id}`;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <BackLink href="/admin/organizations" label="Toutes les organisations" />

      {isPending ? (
        <div className="rounded-2xl border bg-white p-4 text-sm text-slate-500 shadow-sm">
          Chargement...
        </div>
      ) : (
        <>
          <section className="rounded-2xl bg-blue-950 p-5 text-white shadow-lg shadow-blue-950/10 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="break-all text-xs font-semibold uppercase tracking-wide text-blue-100/70">
                    Slug - {org?.slug}
                  </p>
                  {roleLabel ? (
                    <OrganizationRoleBadge
                      label={roleLabel}
                      className="bg-white/15 text-white hover:bg-white/15"
                    />
                  ) : null}
                </div>

                <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                  {org?.name}
                </h2>

                <p className="mt-2 text-sm leading-6 text-blue-50">
                  Utilisez les sections ci-dessous pour administrer cette
                  organisation, ses etablissements, ses membres et ses acces.
                </p>
              </div>

              {canDelete && org ? (
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
                className="group flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-950/25 hover:shadow-md"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-950 text-white">
                    <Icon className="size-4" />
                  </span>
                  <ArrowRight className="size-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-950" />
                </span>

                <span>
                  <span className="block text-base font-semibold text-slate-950">
                    {section.title}
                  </span>
                  <span className="mt-1 block text-sm leading-5 text-slate-600">
                    {section.description}
                  </span>
                </span>
              </Link>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
