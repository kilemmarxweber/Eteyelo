import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LifeBuoy, ShieldCheck } from "lucide-react";
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
    notFound();
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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-3xl bg-blue-950 p-6 text-white shadow-2xl shadow-blue-950/10 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-card/15 px-3 py-1.5 text-xs font-semibold text-blue-50">
              <LifeBuoy className="size-4" />
              Support plateforme Klambocore
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Équipe support plateforme
            </h1>

            <p className="mt-3 text-sm leading-7 text-blue-50 sm:text-base">
              {canManageAgents
                ? "Gérez les agents Klambocore, organisez le support plateforme et traitez les escalades envoyées par les établissements."
                : "Consultez et traitez les escalades envoyées par les établissements vers l’équipe plateforme Klambocore."}
            </p>
          </div>

          <div className="rounded-3xl bg-card/10 p-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-card text-foreground">
                <ShieldCheck className="size-5" />
              </span>

              <div>
                <p className="text-xs text-blue-100">Escalades reçues</p>
                <p className="text-2xl font-black">{escalations.length}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {canManageAgents && <PlatformSupportAdminClient initialAgents={agents} />}

      <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Escalades reçues
            </h2>
            <p className="text-sm text-muted-foreground">
              Suivez les demandes envoyées par les établissements et
              assignez-les aux agents actifs.
            </p>
          </div>

          <span className="w-fit rounded-full bg-blue-950/10 px-3 py-1 text-xs font-semibold text-foreground">
            {escalations.length} demande(s)
          </span>
        </div>

        <PlatformEscalationsClient
          initialEscalations={escalations}
          platformAgents={activeAgents.map((agent) => ({
            id: agent.id,
            user: {
              name: agent.user.name,
              email: agent.user.email,
            },
          }))}
          canManage={canManageEscalations}
        />
      </section>

      <Button variant="ghost" asChild className="w-fit rounded-full">
        <Link href="/admin">
          <ArrowLeft className="mr-2 size-4" />
          Retour au tableau de bord
        </Link>
      </Button>
    </div>
  );
}
