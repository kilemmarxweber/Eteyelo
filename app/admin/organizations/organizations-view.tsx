"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Headphones,
  Plus,
  ShieldCheck,
} from "lucide-react";

import { ArchiveOrganizationButton } from "@/app/admin/organizations/components/archive-organization-dialog";
import { DeleteOrganizationButton } from "@/app/admin/organizations/components/delete-organization-dialog";
import { OrganizationRoleBadge } from "@/app/admin/organizations/components/organization-role-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useOrganizationsAccess } from "@/lib/hooks/use-organizations-access";
import { APP_ROLE } from "@/lib/permissions";

export function OrganizationsView() {
  const { data: session } = authClient.useSession();
  const {
    organizations: orgs,
    canCreate: canCreateOrganization,
    isPlatformOwner,
    roleLabel,
    isPending,
    reload,
  } = useOrganizationsAccess();

  const isPlatformSupport =
    session?.user?.role === APP_ROLE.PLATFORM_SUPPORT;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-lg shadow-primary/10 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-7xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold">
                <Building2 className="size-3.5" />
                Organisations
              </div>
              <OrganizationRoleBadge
                label={roleLabel}
                className="bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/15"
              />
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              {isPlatformOwner
                ? "Toutes les organisations Klambocore"
                : "Gere les espaces Klambocore"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-primary-foreground/90">
              {isPlatformOwner
                ? "Vue plateforme complete : creez, consultez et gerez toutes les organisations."
                : "Retrouvez les organisations, leurs etablissements et les equipes associees depuis une interface claire."}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
            {isPlatformOwner || isPlatformSupport ? (
              <Button
                size="sm"
                variant="secondary"
                className="rounded-full bg-card text-foreground hover:bg-muted"
                asChild
              >
                <Link href="/admin/platform-support">
                  <Headphones className="mr-1.5 size-3.5" />
                  Support Klambocore
                </Link>
              </Button>
            ) : null}

            {canCreateOrganization ? (
              <Button
                size="sm"
                className="rounded-full"
                asChild
              >
                <Link href="/admin/organizations/new">
                  <Plus className="mr-1.5 size-3.5" />
                  Creer une organisation
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-1 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {isPlatformOwner
                ? "Toutes les organisations"
                : "Mes organisations"}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isPending
                ? "Chargement..."
                : `${orgs.length} organisation${orgs.length > 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {orgs.length === 0 && !isPending ? (
          <div className="pt-5">
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
          <div className="grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-3">
            {orgs.map((org) => (
              <div
                key={org.id}
                className="group relative flex flex-col justify-between rounded-xl border bg-muted p-3.5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/admin/organizations/${org.id}`}
                    className="flex min-w-0 flex-1 items-start gap-3"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <ShieldCheck className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {org.name}
                      </span>
                      <span className="mt-0.5 block break-all text-xs text-muted-foreground">
                        {org.slug}
                      </span>
                      {org.isArchived ? (
                        <span className="mt-1 inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                          Archivee
                        </span>
                      ) : null}
                    </span>
                  </Link>

                  <div className="flex items-center gap-1">
                    {org.canArchive ? (
                      <ArchiveOrganizationButton
                        organizationId={org.id}
                        organizationName={org.name}
                        isArchived={Boolean(org.isArchived)}
                        onDone={() => void reload()}
                      />
                    ) : null}
                    {org.canDelete ? (
                      <DeleteOrganizationButton
                        organizationId={org.id}
                        organizationName={org.name}
                        onDeleted={() => void reload()}
                      />
                    ) : null}
                    <Link
                      href={`/admin/organizations/${org.id}`}
                      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      <ArrowRight className="size-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
