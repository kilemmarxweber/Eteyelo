import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { canAccessBranchOrgSettings } from "@/lib/auth/session-roles";
import { listActiveOrganizationSupportAgents } from "@/lib/support/organization-support";
import { EstablishmentSupportView } from "./establishment-support-view";

export default async function SettingsSupportPage({
  params,
}: {
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const { organizationId, branchId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!canAccessBranchOrgSettings(session)) {
    notFound();
  }

  const team = await listActiveOrganizationSupportAgents(
    organizationId,
    branchId,
  );

  return (
    <EstablishmentSupportView team={team} organizationId={organizationId} />
  );
}
