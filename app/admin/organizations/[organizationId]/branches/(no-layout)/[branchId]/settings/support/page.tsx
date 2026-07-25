import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";
import { listActiveOrganizationSupportAgents } from "@/lib/support/organization-support";
import { EstablishmentSupportView } from "./establishment-support-view";

export default async function SettingsSupportPage({
  params,
}: {
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const { organizationId, branchId } = await params;
  await assertBranchAreaAccess("branch_org_settings");

  const team = await listActiveOrganizationSupportAgents(
    organizationId,
    branchId,
  );

  return (
    <EstablishmentSupportView team={team} organizationId={organizationId} />
  );
}
