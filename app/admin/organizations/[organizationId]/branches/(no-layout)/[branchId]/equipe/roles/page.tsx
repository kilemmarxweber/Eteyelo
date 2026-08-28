import { OrganizationRolesManager } from "@/app/admin/organizations/[organizationId]/roles/roles-manager";
import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { enforceOrganizationOwnerPage } from "@/lib/auth/require-organization-permission";

export default async function BranchTeamRolesPage({
  params,
}: {
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const { organizationId, branchId } = await params;
  await enforceOrganizationOwnerPage(organizationId);
  const teamHref = `/admin/organizations/${organizationId}/branches/${branchId}/equipe`;

  return (
    <BranchPageShell
      title="Rôles & privilèges"
      description="Ces rôles appartiennent à l’organisation : toute modification s’applique à l’ensemble de ses établissements."
      backHref={teamHref}
      backLabel="Retour à l’équipe"
      contentClassName="mx-auto w-full max-w-7xl"
    >
      <OrganizationRolesManager organizationId={organizationId} />
    </BranchPageShell>
  );
}
