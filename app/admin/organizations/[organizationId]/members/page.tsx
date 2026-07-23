import { headers } from "next/headers";
import { InviteMemberControls } from "./invite-member-controls";
import { OrganizationMembersView } from "./members-view";
import { auth } from "@/lib/auth";
import { getOrganizationInvitationsConfig } from "@/lib/invitations/config";
import { isPlatformOwnerRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { enforceOrganizationManagerPage } from "@/lib/auth/require-organization-permission";

export default async function OrganizationMembersPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  await enforceOrganizationManagerPage(organizationId);

  const session = await auth.api.getSession({ headers: await headers() });
  const isOwner = isPlatformOwnerRole(session?.user?.role);
  const config = await getOrganizationInvitationsConfig(organizationId);

  const showInvite = isOwner && config.enabled;
  const pendingInvitations = showInvite
    ? await prisma.invitation.findMany({
        where: {
          organizationId,
          status: "pending",
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <OrganizationMembersView
      organizationId={organizationId}
      invitePanel={
        showInvite ? (
          <InviteMemberControls
            organizationId={organizationId}
            invitableRoles={config.invitableRoles}
            initialInvitations={pendingInvitations}
          />
        ) : null
      }
    />
  );
}
