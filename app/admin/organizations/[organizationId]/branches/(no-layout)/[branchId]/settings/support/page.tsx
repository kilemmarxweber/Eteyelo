import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";
import { listActiveOrganizationSupportAgents } from "@/lib/support/organization-support";
import { listMySupportTicketsAction } from "@/lib/support/actions";
import { EstablishmentSupportView } from "./establishment-support-view";
import type { MySupportTicket } from "./my-support-tickets";

export default async function SettingsSupportPage({
  params,
}: {
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const { organizationId, branchId } = await params;
  await assertBranchAreaAccess("support_settings");

  const [team, ticketsResult] = await Promise.all([
    listActiveOrganizationSupportAgents(organizationId, branchId),
    listMySupportTicketsAction({ organizationId }),
  ]);

  const myTickets = (ticketsResult.ok ? ticketsResult.items : []) as MySupportTicket[];

  return (
    <EstablishmentSupportView
      team={team}
      organizationId={organizationId}
      branchId={branchId}
      myTickets={myTickets}
    />
  );
}
