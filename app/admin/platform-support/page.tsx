import Link from "next/link";
import { redirect } from "next/navigation";
import { LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canManagePlatformSupport } from "@/lib/support/permissions";
import { listAllPlatformSupportAgents } from "@/lib/support/platform-support";
import { listPlatformEscalationsAction } from "@/lib/support/actions";
import { PlatformSupportAdminClient } from "./platform-support-client";

export default async function PlatformSupportAdminPage() {
  if (!(await canManagePlatformSupport())) {
    redirect("/admin");
  }

  const [agents, escalationsResult] = await Promise.all([
    listAllPlatformSupportAgents(),
    listPlatformEscalationsAction(),
  ]);

  const escalations = escalationsResult.ok ? escalationsResult.items : [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <LifeBuoy className="size-4" />
          Support plateforme Klambocore
        </div>
        <h1 className="text-2xl font-bold">Équipe support plateforme</h1>
        <p className="text-sm text-muted-foreground">
          Gérez les agents Klambocore qui assistent toutes les organisations.
          Les supports d&apos;établissement peuvent escalader vers cette équipe.
        </p>
      </div>

      <PlatformSupportAdminClient initialAgents={agents} />

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Escalades reçues</h2>
          <span className="text-sm text-muted-foreground">
            {escalations.length} demande(s)
          </span>
        </div>

        {escalations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune escalade pour le moment.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {escalations.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border bg-card p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.subject}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.organization.name} · {item.requesterUser.name} (
                      {item.requesterUser.email})
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {item.status}
                  </span>
                </div>
                <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                  {item.message}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Button variant="ghost" asChild className="w-fit">
        <Link href="/admin">
          ← Retour au tableau de bord
        </Link>
      </Button>
    </div>
  );
}
