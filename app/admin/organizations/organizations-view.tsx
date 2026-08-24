"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Headphones,
  Plus,
  Search,
} from "lucide-react";

import { ArchiveOrganizationButton } from "@/app/admin/organizations/components/archive-organization-dialog";
import { DeleteOrganizationButton } from "@/app/admin/organizations/components/delete-organization-dialog";
import { OrganizationRoleBadge } from "@/app/admin/organizations/components/organization-role-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { useOrganizationsAccess } from "@/lib/hooks/use-organizations-access";
import { APP_ROLE } from "@/lib/permissions";
import { cn } from "@/lib/utils";

function orgInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

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
  const [query, setQuery] = useState("");

  const isPlatformSupport =
    session?.user?.role === APP_ROLE.PLATFORM_SUPPORT;

  const filteredOrgs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter(
      (org) =>
        org.name.toLowerCase().includes(q) ||
        org.slug.toLowerCase().includes(q),
    );
  }, [orgs, query]);

  const activeCount = orgs.filter((org) => !org.isArchived).length;
  const archivedCount = orgs.length - activeCount;

  return (
    <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 h-64 bg-[radial-gradient(ellipse_at_top,_oklch(0.72_0.12_250_/_0.16),_transparent_65%)]"
      />

      <section className="relative overflow-hidden rounded-[1.5rem] bg-primary p-5 text-primary-foreground shadow-lg shadow-primary/15 sm:p-6">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_oklch(1_0_0_/_0.18),_transparent_50%)]"
        />
        <div
          aria-hidden
          className="absolute -bottom-16 -right-10 size-44 rounded-full border border-primary-foreground/10"
        />
        <div
          aria-hidden
          className="absolute -left-8 top-8 size-28 rounded-full bg-primary-foreground/5"
        />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-7xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                <Building2 className="size-3.5" />
                Organisations
              </div>
              <OrganizationRoleBadge
                label={roleLabel}
                className="bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/15"
              />
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              {isPlatformOwner
                ? "Toutes les organisations Klambocore"
                : "Gérez les espaces Klambocore"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-primary-foreground/90">
              {isPlatformOwner
                ? "Vue plateforme complète : créez, consultez et gérez toutes les organisations."
                : "Retrouvez les organisations, leurs établissements et les équipes associées."}
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
              <Button size="sm" className="rounded-full bg-card text-foreground hover:bg-muted" asChild>
                <Link href="/admin/organizations/new">
                  <Plus className="mr-1.5 size-3.5" />
                  Créer une organisation
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[1.5rem] border border-border/70 bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border/70 bg-gradient-to-b from-muted/40 to-transparent p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {isPlatformOwner
                ? "Toutes les organisations"
                : "Mes organisations"}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isPending
                ? "Chargement…"
                : `${orgs.length} organisation${orgs.length > 1 ? "s" : ""}${
                    archivedCount > 0
                      ? ` · ${activeCount} active${activeCount > 1 ? "s" : ""} · ${archivedCount} archivée${archivedCount > 1 ? "s" : ""}`
                      : ""
                  }`}
            </p>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher une organisation…"
              className="h-10 rounded-full border-border/80 bg-background pl-9"
              disabled={isPending || orgs.length === 0}
            />
          </div>
        </div>

        {isPending ? (
          <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-14 animate-pulse rounded-xl border border-border/60 bg-muted/60"
              />
            ))}
          </div>
        ) : orgs.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Aucune organisation"
              description="Créez votre premier espace pour inviter des membres et centraliser la gestion."
              action={
                canCreateOrganization ? (
                  <Link href="/admin/organizations/new">
                    <Button>Créer une organisation</Button>
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : filteredOrgs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Aucune organisation ne correspond à « {query.trim()} ».
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:p-4">
            {filteredOrgs.map((org) => (
              <div
                key={org.id}
                className={cn(
                  "group relative flex items-center gap-2.5 overflow-hidden rounded-xl border border-border/80 bg-card px-3 py-2.5 transition",
                  "hover:border-primary/30 hover:bg-muted/40 hover:shadow-sm",
                  org.isArchived && "opacity-80",
                )}
              >
                <Link
                  href={`/admin/organizations/${org.id}`}
                  className="flex min-w-0 flex-1 items-center gap-2.5"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-[11px] font-bold tracking-wide text-primary-foreground">
                    {orgInitials(org.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {org.name}
                      </span>
                      {org.isArchived ? (
                        <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                          Archivée
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">
                      {org.slug}
                    </span>
                  </span>
                </Link>

                <div className="flex shrink-0 items-center gap-0.5">
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
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label={`Ouvrir ${org.name}`}
                  >
                    <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
