"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CirclePlus, Shield, Users, School } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export default function AdminOrganizationHomePage() {
  const params = useParams();
  const id = params.organizationId as string;

  const { data: orgs, isPending } = authClient.useListOrganizations();

  const list = Array.isArray(orgs) ? orgs : [];
  const org = list.find((o) => o.id === id);

  const base = `/admin/organizations/${id}`;

  if (!isPending && !org) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-6">
        <p className="text-muted-foreground">Organisation introuvable.</p>

        <Button variant="outline" className="mt-4" asChild>
          <Link href="/admin/organizations">Retour à la liste</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      {isPending ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <>
          <div className="space-y-1">
            <p className="break-all text-xs text-muted-foreground">
              Slug · {org?.slug}
            </p>

            <p className="text-sm leading-relaxed text-muted-foreground">
              Utilisez les sections ci-dessous pour administrer cette
              organisation.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              asChild
              className="h-auto min-h-24 justify-start p-4"
            >
              <Link href={`${base}/branches`}>
                <div className="flex min-w-0 flex-col gap-2 text-left">
                  <School className="size-7 text-primary" aria-hidden />

                  <span className="text-base font-semibold">
                    Établissements
                  </span>

                  <span className="text-sm text-muted-foreground">
                    Gérer les établissements, campus ou antennes de
                    l’organisation.
                  </span>
                </div>
              </Link>
            </Button>

            <Button
              variant="outline"
              asChild
              className="h-auto min-h-24 justify-start p-4"
            >
              <Link href={`${base}/members`}>
                <div className="flex min-w-0 flex-col gap-2 text-left">
                  <Users className="size-7 text-primary" aria-hidden />

                  <span className="text-base font-semibold">Membres</span>

                  <span className="text-sm text-muted-foreground">
                    Créer des comptes, ajouter ou modifier les membres.
                  </span>
                </div>
              </Link>
            </Button>

            <Button
              variant="outline"
              asChild
              className="h-auto min-h-24 justify-start p-4"
            >
              <Link href={`${base}/roles`}>
                <div className="flex min-w-0 flex-col gap-2 text-left">
                  <Shield className="size-7 text-primary" aria-hidden />

                  <span className="text-base font-semibold">
                    Rôles & permissions
                  </span>

                  <span className="text-sm text-muted-foreground">
                    Configurer les rôles métier et les droits associés.
                  </span>
                </div>
              </Link>
            </Button>

            <Button
              variant="outline"
              asChild
              className="h-auto min-h-24 justify-start p-4"
            >
              <Link href={`${base}/families`}>
                <div className="flex min-w-0 flex-col gap-2 text-left">
                  <CirclePlus className="size-7 text-primary" aria-hidden />

                  <span className="text-base font-semibold">Familles</span>

                  <span className="text-sm text-muted-foreground">
                    Gérer les parents, tuteurs et responsables légaux.
                  </span>
                </div>
              </Link>
            </Button>
          </div>

          <Button variant="ghost" asChild>
            <Link href="/admin/organizations">← Toutes les organisations</Link>
          </Button>
        </>
      )}
    </div>
  );
}
