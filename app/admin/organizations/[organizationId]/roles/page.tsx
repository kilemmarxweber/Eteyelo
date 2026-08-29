"use client";

import { useParams } from "next/navigation";
import { BackLink } from "@/components/ui/back-link";
import { OrganizationRolesManager } from "./roles-manager";

export default function OrganizationRolesPage() {
  const params = useParams();
  const organizationId = params.organizationId as string;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-5 px-[max(1rem,env(safe-area-inset-left))] py-5 pr-[max(1rem,env(safe-area-inset-right))] pb-8 md:px-6">
      <BackLink
        href={`/admin/organizations/${organizationId}`}
        label="Retour organisation"
      />

      <div>
        <h1 className="text-xl font-semibold">Rôles & privilèges</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Contrôle d&apos;accès dynamique (Better Auth). Après Enregistrer,
          les permissions OrganizationRole s&apos;appliquent aux zones protégées
          (finance, notes, RH…). Rechargez la session / la page de l&apos;utilisateur
          concerné pour voir l&apos;effet. Les menus sidebar restent encore en partie
          basés sur le nom du rôle.
        </p>
      </div>

      <OrganizationRolesManager organizationId={organizationId} />
    </div>
  );
}
