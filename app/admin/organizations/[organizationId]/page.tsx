"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ChartBar,
  CirclePlus,
  Headphones,
  School,
  Shield,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

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
];

export default function AdminOrganizationHomePage() {
  const params = useParams();
  const id = params.organizationId as string;

  const { data: orgs, isPending } = authClient.useListOrganizations();

  const list = Array.isArray(orgs) ? orgs : [];
  const org = list.find((o) => o.id === id);

  const base = `/admin/organizations/${id}`;

  if (!isPending && !org) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Organisation introuvable.</p>

          <Button variant="outline" className="mt-4 rounded-full" asChild>
            <Link href="/admin/organizations">
              <ArrowLeft className="mr-2 size-4" />
              Retour a la liste
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      {isPending ? (
        <div className="rounded-3xl border bg-white p-6 text-sm text-slate-500 shadow-sm">
          Chargement...
        </div>
      ) : (
        <>
          <section className="rounded-3xl bg-blue-950 p-6 text-white shadow-2xl shadow-blue-950/10 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="break-all text-xs font-semibold uppercase tracking-wide text-blue-100/70">
                  Slug - {org?.slug}
                </p>

                <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                  {org?.name}
                </h2>

                <p className="mt-3 text-sm leading-7 text-blue-50 sm:text-base">
                  Utilisez les sections ci-dessous pour administrer cette
                  organisation, ses etablissements, ses membres et ses acces.
                </p>
              </div>

              <Button
                variant="secondary"
                className="h-11 rounded-full bg-white text-blue-950 hover:bg-blue-50"
                asChild
              >
                <Link href="/admin/organizations">
                  <ArrowLeft className="mr-2 size-4" />
                  Toutes les organisations
                </Link>
              </Button>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sections.map(({ icon: Icon, ...section }) => (
              <Link
                key={section.path}
                href={`${base}/${section.path}`}
                className="group flex min-h-44 flex-col justify-between rounded-3xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-950/25 hover:shadow-xl hover:shadow-blue-950/10"
              >
                <span className="flex items-start justify-between gap-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-950 text-white">
                    <Icon className="size-5" />
                  </span>
                  <ArrowRight className="size-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-950" />
                </span>

                <span className="mt-6">
                  <span className="block text-lg font-bold text-slate-950">
                    {section.title}
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-slate-600">
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
