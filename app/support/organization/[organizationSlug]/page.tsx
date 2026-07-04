import { notFound } from "next/navigation";
import { HeadphonesIcon } from "lucide-react";
import Navbar from "@/app/components/navbar";
import { SUPPORT_TOPICS } from "@/lib/support/types";
import {
  getOrganizationBySlug,
  listActiveOrganizationSupportAgents,
} from "@/lib/support/organization-support";
import { SupportTeamSection } from "@/app/components/support/support-team-section";

type PageProps = {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ branchId?: string }>;
};

export default async function OrganizationSupportPublicPage({
  params,
  searchParams,
}: PageProps) {
  const { organizationSlug } = await params;
  const { branchId } = await searchParams;

  const organization = await getOrganizationBySlug(organizationSlug);

  if (!organization) {
    notFound();
  }

  const team = await listActiveOrganizationSupportAgents(
    organization.id,
    branchId ?? null,
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-14">
        <section className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-950/10 px-3 py-1.5 text-xs font-semibold text-blue-950">
            <HeadphonesIcon className="size-4" />
            Support {organization.name}
          </div>

          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
            Une équipe dédiée à votre établissement
          </h1>

          <p className="mt-4 text-sm leading-relaxed text-slate-600 md:text-base">
            Contactez les agents support de {organization.name} pour toute
            question liée à la gestion scolaire, aux comptes utilisateurs ou aux
            incidents du quotidien.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-950">
            Comment pouvons-nous vous aider ?
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {SUPPORT_TOPICS.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border bg-white p-5 shadow-sm"
              >
                <h3 className="font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {team.length > 0 ? (
          <SupportTeamSection team={team} organizationId={organization.id} />
        ) : (
          <p className="mt-14 text-sm text-slate-600">
            L&apos;équipe support de cet établissement sera bientôt disponible.
            Pour une assistance plateforme, consultez la{" "}
            <a href="/support" className="font-medium text-blue-950 underline">
              page support Kalasa Edu
            </a>
            .
          </p>
        )}
      </main>
    </div>
  );
}
