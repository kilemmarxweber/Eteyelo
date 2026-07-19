import { notFound } from "next/navigation";
import { HeadphonesIcon } from "lucide-react";
import { SUPPORT_TOPICS } from "@/lib/support/types";
import {
  getOrganizationBySlug,
  listActiveOrganizationSupportAgents,
} from "@/lib/support/organization-support";
import { SupportTeamSection } from "@/app/components/support/support-team-section";
import { HomeNavbar } from "@/components/home-navbar";

export const dynamic = "force-dynamic";

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
    <div className="min-h-screen bg-background">
      <HomeNavbar />

      <section className="border-b border-primary/10 bg-primary text-primary-foreground shadow-lg shadow-primary/10">
        <div className="mx-auto max-w-6xl px-4 py-10 md:py-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-xs font-semibold text-primary-foreground/90">
            <HeadphonesIcon className="size-4" />
            Support {organization.name}
          </div>

          <h1 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight md:text-4xl">
            Une equipe dediee a votre etablissement
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-primary-foreground/90 md:text-base">
            Contactez les agents support de {organization.name} pour toute
            question liee a la gestion scolaire, aux comptes utilisateurs ou aux
            incidents du quotidien.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-12 md:py-14">
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Besoins frequents
          </p>
          <h2 className="mt-2 text-lg font-semibold text-foreground">
            Comment pouvons-nous vous aider ?
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {SUPPORT_TOPICS.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/30 hover:bg-primary/5"
              >
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {team.length > 0 ? (
          <SupportTeamSection team={team} organizationId={organization.id} />
        ) : (
          <p className="mt-14 text-sm text-muted-foreground">
            L&apos;equipe support de cet etablissement sera bientot disponible.
            Pour une assistance plateforme, consultez la{" "}
            <a href="/support" className="font-medium text-primary underline">
              page support Kalasa Edu
            </a>
            .
          </p>
        )}
      </main>
    </div>
  );
}
