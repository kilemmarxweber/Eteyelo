import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  ExternalLink,
  HeadphonesIcon,
  LifeBuoy,
} from "lucide-react";
import { BackLink } from "@/components/ui/back-link";
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

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function OrganizationSupportPage({ params }: PageProps) {
  const { organizationId } = await params;

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, slug: true },
  });

  if (!organization) notFound();

  const [canManage, canEscalate] = await Promise.all([
    canManageOrganizationSupport(organizationId),
    canEscalateToPlatformSupport(organizationId),
  ]);

  if (!canManage && !canEscalate) {
    redirect(`/admin/organizations/${organizationId}`);
  }

  const [agents, branches, escalationsResult] = await Promise.all([
    listOrganizationSupportAgents(organizationId),
    prisma.branch.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    listOrganizationEscalationsAction(organizationId),
  ]);

  const escalations = escalationsResult.ok ? escalationsResult.items : [];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <BackLink
        href={`/admin/organizations/${organizationId}`}
        label="Retour organisation"
      />

      <section className="rounded-2xl bg-blue-950 p-5 text-white shadow-lg shadow-blue-950/10 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-blue-50">
              <HeadphonesIcon className="size-3.5" />
              Support {organization.name}
            </div>

            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Support établissement
            </h1>

            <p className="mt-2 text-sm leading-6 text-blue-50">
              Gérez les agents internes qui assistent les utilisateurs de votre
              organisation et escaladez vers Klambocore si nécessaire.
            </p>
          </div>

          {organization.slug && (
            <Button
              size="sm"
              variant="secondary"
              className="rounded-full bg-white text-blue-950 hover:bg-blue-50"
              asChild
            >
              <Link
                href={`/support/organization/${organization.slug}`}
                target="_blank"
              >
                <ExternalLink className="mr-1.5 size-3.5" />
                Page publique support
              </Link>
            </Button>
          )}
        </div>
      </section>

      {canManage && (
        <OrganizationSupportClient
          organizationId={organizationId}
          initialAgents={agents}
          branches={branches}
        />
      )}

      {canEscalate && (
        <section className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-blue-950 text-white">
              <LifeBuoy className="size-4" />
            </span>

            <div>
              <h2 className="text-base font-semibold text-blue-950">
                Contacter Klambocore
              </h2>
              <p className="mt-0.5 text-sm leading-5 text-slate-600">
                Utilisez ce canal pour les incidents nécessitant l’intervention
                de l’équipe plateforme.
              </p>
            </div>
          </div>

          <div className="mt-4">
            <OrganizationSupportClient
              organizationId={organizationId}
              initialAgents={[]}
              branches={[]}
              escalationOnly
            />
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-950">
          Historique des escalades
        </h2>

        {escalations.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-white p-5 text-sm text-slate-600 shadow-sm">
            Aucune escalade.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {escalations.map((item) => {
              const priorityLabel =
                ESCALATION_PRIORITY_LABELS[
                  item.priority as keyof typeof ESCALATION_PRIORITY_LABELS
                ] ?? item.priority;

              const statusLabel =
                ESCALATION_STATUS_LABELS[item.status as EscalationStatus] ??
                item.status;

              return (
                <article
                  key={item.id}
                  className="rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-950/25 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-950">
                      {item.subject}
                    </h3>

                    <span className="rounded-full bg-blue-950/10 px-2 py-0.5 text-xs font-semibold text-blue-950">
                      {statusLabel}
                    </span>
                  </div>

                  <p className="mt-2 text-sm leading-5 text-slate-600">
                    {item.requesterUser.name} · Priorité {priorityLabel}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(item.createdAt).toLocaleDateString("fr-FR")}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
