import { NextResponse } from "next/server";

import { getCachedSession } from "@/lib/auth/get-session-cached";
import { guardOrganizationAccess } from "@/lib/auth/require-organization-permission";
import {
  countUnreadConversations,
  isOrganizationMessagingEnabled,
} from "@/lib/messaging/messaging-service";
import { APP_ROLE } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await params;
  if (!organizationId) {
    return NextResponse.json({ error: "Organisation requise" }, { status: 400 });
  }

  try {
    const enabled = await isOrganizationMessagingEnabled(organizationId);
    if (!enabled) {
      return NextResponse.json({ count: 0 });
    }

    const guard = await guardOrganizationAccess(organizationId);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.message }, { status: 403 });
    }

    const session = await getCachedSession();
    const userId = guard.context.userId;
    const member = await prisma.member.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: {
        role: true,
        isArchived: true,
        user: { select: { banned: true } },
      },
    });
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { messagingEnabled: true },
    });

    const count = await countUnreadConversations({
      organizationId,
      actor: {
        userId,
        appRole: guard.context.appRole ?? APP_ROLE.USER,
        memberRole: member?.role ?? null,
        memberArchived: member?.isArchived ?? false,
        userBanned: member?.user.banned ?? false,
        sourceBranchId:
          session?.session?.activeBranchId ?? session?.branch?.id ?? null,
        messagingEnabled: org?.messagingEnabled !== false,
      },
    });

    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
}
