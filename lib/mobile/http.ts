import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { APP_ROLE } from "@/lib/permissions";
import {
  canUseMessaging,
  canSendMessages,
  canCreateGroup,
} from "@/lib/messaging/messaging-policy";
import { isOrganizationMessagingEnabled } from "@/lib/messaging/messaging-service";
import { isProfileComplete } from "@/lib/mobile/session";
import { formatMessagingPersonName } from "@/lib/messaging/messaging-types";

export type MobileSession = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>;

export async function getMobileSession(): Promise<MobileSession | null> {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, { status: 200, ...init });
}

export function jsonCreated<T>(data: T) {
  return NextResponse.json({ ok: true, data }, { status: 201 });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function requireSession(session: MobileSession | null) {
  if (!session?.user?.id) {
    return null;
  }
  return session;
}

export async function buildMePayload(session: MobileSession) {
  const userId = session.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      prenom: true,
      postnom: true,
      image: true,
      telephone: true,
      email: true,
      role: true,
      banned: true,
      statusUser: true,
    },
  });

  if (!user) {
    throw new Error("Utilisateur introuvable.");
  }

  const memberships = await prisma.member.findMany({
    where: { userId, isArchived: false },
    select: {
      id: true,
      role: true,
      organizationId: true,
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          messagingEnabled: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const organizations = await Promise.all(
    memberships.map(async (m) => {
      const messagingEnabled = m.organization.messagingEnabled !== false;
      const policy = {
        appRole: user.role ?? APP_ROLE.USER,
        memberRole: m.role,
        memberArchived: false,
        userBanned: user.banned ?? false,
        organizationMessagingEnabled: messagingEnabled,
      };
      return {
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        logo: m.organization.logo,
        memberRole: m.role,
        messagingEnabled,
        canRead: canUseMessaging(policy),
        canSend: canSendMessages(policy),
        canCreateGroup: canCreateGroup(policy),
      };
    }),
  );

  const activeOrganizationId =
    session.session.activeOrganizationId ?? organizations[0]?.id ?? null;

  return {
    user: {
      id: user.id,
      name: formatMessagingPersonName(user),
      prenom: user.prenom,
      postnom: user.postnom,
      image: user.image,
      telephone: user.telephone,
      email: user.email,
      role: user.role,
    },
    profileComplete: isProfileComplete(user),
    needsOnboarding: !isProfileComplete(user),
    activeOrganizationId,
    organizations,
    messagingEnabledForActiveOrg: activeOrganizationId
      ? await isOrganizationMessagingEnabled(activeOrganizationId)
      : false,
  };
}

export async function getMessagingActorFromSession(
  session: MobileSession,
  organizationId: string,
) {
  const userId = session.user.id;
  const member = await prisma.member.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: {
      role: true,
      isArchived: true,
      user: { select: { banned: true, role: true } },
    },
  });

  if (!member || member.isArchived) {
    throw new Error("Vous n'appartenez pas à cette organisation.");
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { messagingEnabled: true },
  });

  return {
    userId,
    appRole: member.user.role ?? APP_ROLE.USER,
    memberRole: member.role,
    memberArchived: member.isArchived,
    userBanned: member.user.banned ?? false,
    sourceBranchId: session.session.activeBranchId ?? null,
    messagingEnabled: org?.messagingEnabled !== false,
  };
}
