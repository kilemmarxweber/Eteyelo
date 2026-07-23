import { getOrganizationInvitationsConfig } from "@/lib/invitations/config";
import { APP_ROLE, isPlatformOwnerRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const SINGLE_ORG_MESSAGE =
  "Un utilisateur ne peut appartenir qu'à une seule organisation.";

export type AccessibleOrganizationMembership = {
  organizationId: string;
  role: string;
  organizationName: string;
  organizationSlug: string;
};

export async function countUserOrganizations(userId: string): Promise<number> {
  return prisma.member.count({
    where: { userId, isArchived: false },
  });
}

export async function userBelongsToAnotherOrganization(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const other = await prisma.member.findFirst({
    where: {
      userId,
      organizationId: { not: organizationId },
      isArchived: false,
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

/**
 * Acceptation d'invitation : multi-org autorisé uniquement si la config org
 * l'active. Aucune donnée n'est copiée entre orgs — seul le membership est créé.
 */
export async function assertUserCanAcceptOrganizationInvitation(
  userId: string,
  organizationId: string,
): Promise<void> {
  const belongsElsewhere = await userBelongsToAnotherOrganization(
    userId,
    organizationId,
  );
  if (!belongsElsewhere) return;

  const config = await getOrganizationInvitationsConfig(organizationId);
  if (config.enabled && config.allowMultiOrg) return;

  throw new Error(SINGLE_ORG_MESSAGE);
}

/** Memberships utilisables : membre non archivé + org non archivée. */
export async function listAccessibleOrganizationMemberships(
  userId: string,
): Promise<AccessibleOrganizationMembership[]> {
  const memberships = await prisma.member.findMany({
    where: {
      userId,
      isArchived: false,
      organization: { isArchived: false },
    },
    select: {
      organizationId: true,
      role: true,
      organization: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((membership) => ({
    organizationId: membership.organizationId,
    role: membership.role,
    organizationName: membership.organization.name,
    organizationSlug: membership.organization.slug,
  }));
}

export async function getOrganizationMembership(
  userId: string,
  organizationId: string,
) {
  return prisma.member.findFirst({
    where: {
      userId,
      organizationId,
      isArchived: false,
      organization: { isArchived: false },
    },
    select: { organizationId: true, role: true },
  });
}

export async function getUserOrganizationMembership(userId: string) {
  const membership = await prisma.member.findFirst({
    where: {
      userId,
      isArchived: false,
      organization: { isArchived: false },
    },
    select: { organizationId: true, role: true },
    orderBy: { createdAt: "asc" },
  });
  return membership;
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

  if (activeOrganizationId) {
    const member = await prisma.member.findFirst({
      where: {
        userId,
        organizationId: activeOrganizationId,
        isArchived: false,
        organization: { isArchived: false },
      },
      select: {
        role: true,
        organizationId: true,
        organization: { select: { name: true } },
      },
    });
    if (member) {
      return {
        id: member.organizationId,
        name: member.organization.name,
        role: member.role,
      };
    }
  }

  const member = await prisma.member.findFirst({
    where: {
      userId,
      isArchived: false,
      organization: { isArchived: false },
    },
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
