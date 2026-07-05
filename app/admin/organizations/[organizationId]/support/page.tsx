import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  HeadphonesIcon,
  LifeBuoy,
} from "lucide-react";
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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-3xl bg-blue-950 p-6 text-white shadow-2xl shadow-blue-950/10 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-blue-50">
              <HeadphonesIcon className="size-4" />
              Support {organization.name}
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Support établissement
            </h1>

            <p className="mt-3 text-sm leading-7 text-blue-50 sm:text-base">
              Gérez les agents internes qui assistent les utilisateurs de votre
              organisation et escaladez vers Klambocore si nécessaire.
            </p>
          </div>

          {organization.slug && (
            <Button
              variant="secondary"
              className="h-11 rounded-full bg-white text-blue-950 hover:bg-blue-50"
              asChild
            >
              <Link
                href={`/support/organization/${organization.slug}`}
                target="_blank"
              >
                <ExternalLink className="mr-2 size-4" />
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
        <section className="rounded-3xl border border-blue-200 bg-blue-50/70 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-blue-950 text-white">
              <LifeBuoy className="size-5" />
            </span>

            <div>
              <h2 className="text-lg font-bold text-blue-950">
                Contacter Klambocore
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Utilisez ce canal pour les incidents nécessitant l’intervention
                de l’équipe plateforme.
              </p>
            </div>
          </div>

          <div className="mt-5">
            <OrganizationSupportClient
              organizationId={organizationId}
              initialAgents={[]}
              branches={[]}
              escalationOnly
            />
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-950">
          Historique des escalades
        </h2>

        {escalations.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-white p-6 text-sm text-slate-600 shadow-sm">
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
                  className="rounded-3xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-950/25 hover:shadow-xl hover:shadow-blue-950/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-bold text-slate-950">{item.subject}</h3>

                    <span className="rounded-full bg-blue-950/10 px-3 py-1 text-xs font-semibold text-blue-950">
                      {statusLabel}
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    {item.requesterUser.name} · Priorité {priorityLabel}
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    {new Date(item.createdAt).toLocaleDateString("fr-FR")}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Button variant="ghost" asChild className="w-fit rounded-full">
        <Link href={`/admin/organizations/${organizationId}`}>
          <ArrowLeft className="mr-2 size-4" />
          Retour organisation
        </Link>
      </Button>
    </div>
  );
}
