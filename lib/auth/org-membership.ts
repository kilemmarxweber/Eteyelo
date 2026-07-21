import { APP_ROLE, isPlatformOwnerRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const SINGLE_ORG_MESSAGE =
  "Un utilisateur ne peut appartenir qu'à une seule organisation.";

export async function countUserOrganizations(userId: string): Promise<number> {
  return prisma.member.count({ where: { userId } });
}

export async function userBelongsToAnotherOrganization(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const other = await prisma.member.findFirst({
    where: {
      userId,
      organizationId: { not: organizationId },
    },
    select: { id: true },
  });
  return other !== null;
}

export async function assertUserCanJoinOrganization(
  userId: string,
  organizationId: string,
): Promise<void> {
  if (await userBelongsToAnotherOrganization(userId, organizationId)) {
    throw new Error(SINGLE_ORG_MESSAGE);
  }
}

export async function getUserOrganizationMembership(userId: string) {
  return prisma.member.findFirst({
    where: { userId },
    select: { organizationId: true, role: true },
    orderBy: { createdAt: "asc" },
  });
}

export type SessionOrganization = {
  id: string;
  name: string;
  role: string;
};

/** Contexte org exposé dans la session (org active ou unique appartenance). */
export async function getSessionOrganizationContext(
  userId: string,
  activeOrganizationId?: string | null,
  appRole?: string | null,
): Promise<SessionOrganization | null> {
  // Owner plateforme : peut activer n'importe quelle org sans row Member.
  if (isPlatformOwnerRole(appRole) && activeOrganizationId) {
    const organization = await prisma.organization.findUnique({
      where: { id: activeOrganizationId },
      select: { id: true, name: true },
    });
    if (organization) {
      return {
        id: organization.id,
        name: organization.name,
        role: APP_ROLE.OWNER,
      };
    }
  }

  const member = await prisma.member.findFirst({
    where: activeOrganizationId
      ? { userId, organizationId: activeOrganizationId }
      : { userId },
    select: {
      role: true,
      organizationId: true,
      organization: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!member) return null;

  return {
    id: member.organizationId,
    name: member.organization.name,
    role: member.role,
  };
}
