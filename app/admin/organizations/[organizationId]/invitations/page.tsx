import { notFound } from "next/navigation";
import { BackLink } from "@/components/ui/back-link";
import { getOrganizationAccessAction } from "@/app/admin/organizations/actions";
import { getOrganizationInvitationsConfig } from "@/lib/invitations/config";
import { enforceOrganizationManagerPage } from "@/lib/auth/require-organization-permission";
import { InvitationsConfigForm } from "./invitations-config-form";

export default async function OrganizationInvitationsConfigPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  await enforceOrganizationManagerPage(organizationId);

  const access = await getOrganizationAccessAction(organizationId);
  if (!access?.canListAll) {
    notFound();
  }

  const config = await getOrganizationInvitationsConfig(organizationId);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <BackLink
        href={`/admin/organizations/${organizationId}`}
        label="Retour organisation"
      />

      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold tracking-tight">Invitations</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Configuration réservée au super administrateur. Activez les
          invitations, choisissez les rôles proposés et autorisez le multi-org
          (données toujours isolées).
        </p>

        <div className="mt-6">
          <InvitationsConfigForm
            organizationId={organizationId}
            initialConfig={config}
          />
        </div>
      </section>
    </div>
  );
}
