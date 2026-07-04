"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Headphones,
  Plus,
  ShieldCheck,
} from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { APP_ROLE } from "@/lib/permissions";

export default function AdminOrganizationsPage() {
  const { data: session } = authClient.useSession();
  const { data: orgsData, isPending } = authClient.useListOrganizations();
  const orgs = Array.isArray(orgsData) ? orgsData : [];
  const isPlatformAdmin = session?.user?.role === APP_ROLE.ADMIN;
  const isPlatformSupport = session?.user?.role === APP_ROLE.PLATFORM_SUPPORT;
  const canCreateOrganization = isPlatformAdmin;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-3xl bg-blue-950 p-6 text-white shadow-2xl shadow-blue-950/10 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[350px]">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold">
              <Building2 className="size-4" />
              Organisations
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Gere les espaces Klambocore
            </h2>
            <p className="mt-3 text-sm leading-7 text-blue-50 sm:text-base">
              Retrouvez les organisations, leurs etablissements et les equipes
              associees depuis une interface claire.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
            {isPlatformAdmin || isPlatformSupport ? (
              <Button
                variant="secondary"
                className="h-11 rounded-full bg-white text-blue-950 hover:bg-blue-50"
                asChild
              >
                <Link href="/admin/platform-support">
                  <Headphones className="mr-2 size-4" />
                  Support Klambocore
                </Link>
              </Button>
            ) : null}

            {canCreateOrganization ? (
              <Button
                className="h-11 rounded-full bg-blue-600 text-white hover:bg-blue-700"
                asChild
              >
                <Link href="/admin/organizations/new">
                  <Plus className="mr-2 size-4" />
                  Creer une organisation
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-1 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-950">
              Mes organisations
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {isPending
                ? "Chargement..."
                : `${orgs.length} organisation${orgs.length > 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {orgs.length === 0 && !isPending ? (
          <div className="pt-6">
            <EmptyState
              title="Aucune organisation"
              description="Creez votre premier espace pour inviter des membres et centraliser la gestion."
              action={
                canCreateOrganization ? (
                  <Link href="/admin/organizations/new">
                    <Button>Creer une organisation</Button>
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="grid gap-3 pt-5 md:grid-cols-2 xl:grid-cols-3">
            {orgs.map((org) => (
              <Link
                key={org.id}
                href={`/admin/organizations/${org.id}`}
                className="group flex min-h-36 flex-col justify-between rounded-2xl border bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-blue-950/25 hover:bg-white hover:shadow-lg hover:shadow-blue-950/10"
              >
                <span className="flex items-start justify-between gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue-950 text-white">
                    <ShieldCheck className="size-5" />
                  </span>
                  <ArrowRight className="size-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-950" />
                </span>

                <span className="mt-5">
                  <span className="block truncate text-lg font-bold text-slate-950">
                    {org.name}
                  </span>
                  <span className="mt-1 block break-all text-sm text-slate-500">
                    {org.slug}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
