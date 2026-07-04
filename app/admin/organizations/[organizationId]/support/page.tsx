import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, HeadphonesIcon, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import {
  canEscalateToPlatformSupport,
  canManageOrganizationSupport,
} from "@/lib/support/permissions";
import { listOrganizationSupportAgents } from "@/lib/support/organization-support";
import { listOrganizationEscalationsAction } from "@/lib/support/actions";
import { OrganizationSupportClient } from "./organization-support-client";
import {
  ESCALATION_PRIORITY_LABELS,
  ESCALATION_STATUS_LABELS,
  type EscalationStatus,
} from "@/lib/support/constants";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function OrganizationSupportPage({ params }: PageProps) {
  const { organizationId } = await params;

  const [canManage, canEscalate] = await Promise.all([
    canManageOrganizationSupport(organizationId),
    canEscalateToPlatformSupport(organizationId),
  ]);

  if (!canManage && !canEscalate) {
    redirect(`/admin/organizations/${organizationId}`);
  }

  const [organization, agents, branches, escalationsResult] = await Promise.all(
    [
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, slug: true },
      }),
      listOrganizationSupportAgents(organizationId),
      prisma.branch.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      listOrganizationEscalationsAction(organizationId),
    ],
  );

  if (!organization) {
    redirect("/admin/organizations");
  }

  const escalations = escalationsResult.ok ? escalationsResult.items : [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <HeadphonesIcon className="size-4" />
          Support {organization.name}
        </div>
        <h1 className="text-2xl font-bold">Support établissement</h1>
        <p className="text-sm text-muted-foreground">
          Agents internes qui assistent les utilisateurs de votre organisation.
          Ils peuvent escalader vers l&apos;équipe Klambocore si nécessaire.
        </p>
        {organization.slug ? (
          <Button variant="outline" size="sm" className="mt-2" asChild>
            <Link
              href={`/support/organization/${organization.slug}`}
              target="_blank"
            >
              <ExternalLink className="mr-1.5 size-3.5" />
              Page publique support
            </Link>
          </Button>
        ) : null}
      </div>

      {canManage && (
        <OrganizationSupportClient
          organizationId={organizationId}
          initialAgents={agents}
          branches={branches}
        />
      )}

      {canEscalate && (
        <section className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/50 p-5">
          <div className="flex items-center gap-2">
            <LifeBuoy className="size-5 text-blue-950" />
            <h2 className="text-lg font-semibold text-blue-950">
              Contacter Klambocore (escalade plateforme)
            </h2>
          </div>
          <p className="text-sm text-slate-600">
            Réservé aux agents support de l&apos;établissement. Utilisez ce
            canal pour les incidents nécessitant l&apos;intervention de
            l&apos;équipe plateforme.
          </p>
          <OrganizationSupportClient
            organizationId={organizationId}
            initialAgents={[]}
            branches={[]}
            escalationOnly
          />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Historique des escalades</h2>
        {escalations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune escalade.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {escalations.map((item) => {
              const priorityLabel =
                ESCALATION_PRIORITY_LABELS[
                  item.priority as keyof typeof ESCALATION_PRIORITY_LABELS
                ] ?? item.priority;
              const statusLabel =
                ESCALATION_STATUS_LABELS[item.status as EscalationStatus] ??
                item.status;

              return (
                <li key={item.id} className="rounded-xl border bg-card p-4">
                  <div className="flex justify-between gap-2">
                    <p className="font-medium">{item.subject}</p>
                    <span className="text-xs text-muted-foreground">
                      {statusLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.requesterUser.name} · Priorité {priorityLabel} ·{" "}
                    {new Date(item.createdAt).toLocaleDateString("fr-FR")}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Button variant="ghost" asChild className="w-fit">
        <Link href={`/admin/organizations/${organizationId}`}>
          ← Retour organisation
        </Link>
      </Button>
    </div>
  );
}
