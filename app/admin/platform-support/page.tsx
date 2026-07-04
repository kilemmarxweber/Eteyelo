import Link from "next/link";
import { redirect } from "next/navigation";
import { LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  canAccessPlatformSupportArea,
  canManagePlatformEscalations,
  canManagePlatformSupport,
} from "@/lib/support/permissions";
import { listAllPlatformSupportAgents } from "@/lib/support/platform-support";
import { listPlatformEscalationsAction } from "@/lib/support/actions";
import { PlatformSupportAdminClient } from "./platform-support-client";
import { PlatformEscalationsClient } from "./platform-escalations-client";

export default async function PlatformSupportAdminPage() {
  if (!(await canAccessPlatformSupportArea())) {
    redirect("/admin");
  }

  const [canManageAgents, canManageEscalations] = await Promise.all([
    canManagePlatformSupport(),
    canManagePlatformEscalations(),
  ]);

  const [agents, escalationsResult] = await Promise.all([
    canManageAgents ? listAllPlatformSupportAgents() : Promise.resolve([]),
    listPlatformEscalationsAction(),
  ]);

  const escalations = escalationsResult.ok ? escalationsResult.items : [];
  const activeAgents = agents.filter((agent) => agent.isActive);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <LifeBuoy className="size-4" />
          Support plateforme Klambocore
        </div>
        <h1 className="text-2xl font-bold">Équipe support plateforme</h1>
        <p className="text-sm text-muted-foreground">
          {canManageAgents
            ? "Gérez les agents Klambocore et traitez les escalades des établissements."
            : "Consultez et traitez les escalades envoyées par les établissements."}
        </p>
      </div>

      {canManageAgents && (
        <PlatformSupportAdminClient initialAgents={agents} />
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Escalades reçues</h2>
          <span className="text-sm text-muted-foreground">
            {escalations.length} demande(s)
          </span>
        </div>

        <PlatformEscalationsClient
          initialEscalations={escalations}
          platformAgents={activeAgents.map((agent) => ({
            id: agent.id,
            user: { name: agent.user.name, email: agent.user.email },
          }))}
          canManage={canManageEscalations}
        />
      </section>

      <Button variant="ghost" asChild className="w-fit">
        <Link href="/admin">← Retour au tableau de bord</Link>
      </Button>
    </div>
  );
}
