import { auth } from "@/lib/auth";
import { getUserOrganizationMembership } from "@/lib/auth/org-membership";
import {
  isAppAdminRole,
  isPlatformOwnerRole,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  getOrganizationAccessRoleLabel,
  isOrganizationOwnerMember,
} from "@/lib/auth/role-labels";

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
};

/** Le propriétaire plateforme voit toutes les organisations. */
export function canListAllOrganizations(
  appRole: string | null | undefined,
): boolean {
  return isPlatformOwnerRole(appRole);
}

/** Seul le propriétaire plateforme peut créer des organisations. */
export function canCreateOrganization(
  appRole: string | null | undefined,
): boolean {
  return isPlatformOwnerRole(appRole);
}

/** Seul le propriétaire plateforme ou le propriétaire org peut supprimer. */
export function canDeleteOrganization(
  appRole: string | null | undefined,
  orgMemberRole?: string | null,
): boolean {
  if (isPlatformOwnerRole(appRole)) return true;
  return isOrganizationOwnerMember(orgMemberRole);
}

export function canDeleteSpecificOrganization(
  appRole: string | null | undefined,
  organizationId: string,
  membership?: { organizationId: string; role: string } | null,
): boolean {
  if (isPlatformOwnerRole(appRole)) return true;
  if (!membership || membership.organizationId !== organizationId) {
    return false;
  }
  return isOrganizationOwnerMember(membership.role);
}

/** Le gestionnaire applicatif (admin) peut lire/modifier son organisation uniquement. */
export function canManageOrganizationAsAppAdmin(
  appRole: string | null | undefined,
): boolean {
  return isAppAdminRole(appRole);
}

export async function listOrganizationsForUser(
  userId: string,
  appRole: string | null | undefined,
): Promise<OrganizationSummary[]> {
  if (canListAllOrganizations(appRole)) {
    return prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  const memberships = await prisma.member.findMany({
    where: { userId },
    select: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((membership) => membership.organization);
}

export async function canAccessOrganization(
  userId: string,
  appRole: string | null | undefined,
  organizationId: string,
): Promise<boolean> {
  if (canListAllOrganizations(appRole)) return true;

  const membership = await prisma.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    select: { id: true },
  });

  return membership != null;
}

export async function getOrganizationByIdForUser(
  userId: string,
  appRole: string | null | undefined,
  organizationId: string,
): Promise<OrganizationSummary | null> {
  const canAccess = await canAccessOrganization(userId, appRole, organizationId);
  if (!canAccess) return null;

  return prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
    },
  });
}

export async function getOrganizationsAccessContext(requestHeaders: Headers) {
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user?.id) {
    return null;
  }

  const appRole = session.user.role;
  const organizations = await listOrganizationsForUser(
    session.user.id,
    appRole,
  );
  const membership = await getUserOrganizationMembership(session.user.id);

  return {
    userId: session.user.id,
    appRole,
    organizations: organizations.map((organization) => ({
      ...organization,
      canDelete: canDeleteSpecificOrganization(
        appRole,
        organization.id,
        membership,
      ),
    })),
    membership,
    canCreate: canCreateOrganization(appRole),
    canDelete: canDeleteOrganization(appRole, membership?.role),
    canListAll: canListAllOrganizations(appRole),
    isPlatformOwner: isPlatformOwnerRole(appRole),
    isOrgManager: isAppAdminRole(appRole),
    roleLabel: getOrganizationAccessRoleLabel(appRole, membership?.role),
    membershipRole: membership?.role ?? null,
    membershipOrganizationId: membership?.organizationId ?? null,
  };
}
