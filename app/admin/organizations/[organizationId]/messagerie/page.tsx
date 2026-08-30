import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MessageSquareOff } from "lucide-react";

import { MessagingWorkspace } from "@/components/messaging/messaging-workspace";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { canAccessBranchOrgSettings } from "@/lib/auth/session-roles";
import { enforceOrganizationSectionAccess } from "@/lib/auth/require-organization-permission";
import {
  canCreateGroup,
  canPurgeOrganizationMessaging,
  canUseMessaging,
} from "@/lib/messaging/messaging-policy";
import { prisma } from "@/lib/prisma";

export default async function OrganizationMessagingPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{
    c?: string;
    fromBranch?: string;
    contextType?: string;
    contextId?: string;
  }>;
}) {
  const { organizationId } = await params;
  const query = await searchParams;
  const context = await enforceOrganizationSectionAccess(organizationId);

  const [member, organization] = await Promise.all([
    prisma.member.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: context.userId,
        },
      },
      select: {
        role: true,
        isArchived: true,
        user: { select: { banned: true } },
      },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { messagingEnabled: true },
    }),
  ]);

  const policy = {
    appRole: context.appRole,
    memberRole: member?.role,
    memberArchived: member?.isArchived,
    userBanned: member?.user.banned,
  };

  if (!canUseMessaging(policy)) {
    notFound();
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  const fromBranchId = query.fromBranch ?? null;
  const backHref = fromBranchId
    ? `/admin/organizations/${organizationId}/branches/${fromBranchId}`
    : `/admin/organizations/${organizationId}`;

  if (organization?.messagingEnabled === false) {
    const canManage = canAccessBranchOrgSettings(session);
    let settingsBranchId = fromBranchId;
    if (canManage && !settingsBranchId) {
      const branch = await prisma.branch.findFirst({
        where: { organizationId, isActive: true },
        select: { id: true },
        orderBy: { name: "asc" },
      });
      settingsBranchId = branch?.id ?? null;
    }
    const settingsHref = settingsBranchId
      ? `/admin/organizations/${organizationId}/branches/${settingsBranchId}/settings/messagerie`
      : null;

    return (
      <div className="flex min-h-[100dvh] flex-col bg-background">
        <header className="flex items-center gap-3 border-b px-4 py-3">
          <BackLink href={backHref} label="Retour" />
          <h1 className="text-lg font-semibold">Messagerie</h1>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <MessageSquareOff className="size-10 text-muted-foreground" />
          <p className="font-medium">La messagerie est désactivée</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Un responsable de l&apos;organisation peut la réactiver dans
            Paramètres → Messagerie.
          </p>
          {canManage && settingsHref ? (
            <Button asChild>
              <Link href={settingsHref}>Ouvrir les paramètres</Link>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <MessagingWorkspace
      organizationId={organizationId}
      currentUserId={context.userId}
      canPurge={canPurgeOrganizationMessaging(policy)}
      canCreateGroup={canCreateGroup(policy)}
      initialConversationId={query.c ?? null}
      fromBranchId={fromBranchId}
      contextType={query.contextType ?? null}
      contextId={query.contextId ?? null}
    />
  );
}
