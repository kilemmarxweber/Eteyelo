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
          Matrice catalogue (Créer / Voir / Modifier / Supprimer).{" "}
          <strong>Voir</strong> affiche ou masque le menu / sous-menu. Après
          Enregistrer, rechargez la page. Les cases décochées sont enregistrées
          comme refus (plus de réinjection automatique du seed).
        </p>
      </div>

      <OrganizationRolesManager organizationId={organizationId} />
    </div>
  );
}
