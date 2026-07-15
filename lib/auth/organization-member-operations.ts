import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RequestHeaders = Awaited<ReturnType<typeof import("next/headers").headers>>;

export async function updateOrganizationMemberRole(
  input: {
    organizationId: string;
    memberId: string;
    role: string;
    bypassBetterAuthMembership: boolean;
  },
  requestHeaders: RequestHeaders,
) {
  const { organizationId, memberId, role, bypassBetterAuthMembership } = input;

  if (bypassBetterAuthMembership) {
    const member = await prisma.member.findFirst({
      where: { id: memberId, organizationId },
    });
    if (!member) {
      throw new Error("Membre introuvable.");
    }
    await prisma.member.update({
      where: { id: memberId },
      data: { role },
    });
    return;
  }

  await auth.api.updateMemberRole({
    body: {
      memberId,
      organizationId,
      role: role as "owner",
    },
    headers: requestHeaders,
  });
}

export async function removeOrganizationMember(
  input: {
    organizationId: string;
    memberIdOrEmail: string;
    bypassBetterAuthMembership: boolean;
  },
  requestHeaders: RequestHeaders,
) {
  const { organizationId, memberIdOrEmail, bypassBetterAuthMembership } = input;

  if (bypassBetterAuthMembership) {
    const member = await prisma.member.findFirst({
      where: {
        organizationId,
        OR: [
          { id: memberIdOrEmail },
          { user: { email: memberIdOrEmail.toLowerCase() } },
        ],
      },
    });
    if (!member) {
      throw new Error("Membre introuvable.");
    }
    await prisma.member.delete({ where: { id: member.id } });
    return;
  }

  await auth.api.removeMember({
    body: {
      memberIdOrEmail,
      organizationId,
    },
    headers: requestHeaders,
  });
}
