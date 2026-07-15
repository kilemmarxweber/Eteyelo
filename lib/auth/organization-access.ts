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
  isArchived: boolean;
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

/**
 * Suppression physique : owner plateforme uniquement.
 * Le propriétaire org (ORG_ROLE.OWNER) ne peut pas supprimer.
 */
export function canDeleteOrganization(
  appRole: string | null | undefined,
  _orgMemberRole?: string | null,
): boolean {
  return isPlatformOwnerRole(appRole);
}

/**
 * Archivage : owner plateforme ou propriétaire de l'organisation.
 */
export function canArchiveOrganization(
  appRole: string | null | undefined,
  orgMemberRole?: string | null,
): boolean {
  if (isPlatformOwnerRole(appRole)) return true;
  return isOrganizationOwnerMember(orgMemberRole);
}

/**
 * Sections réservées aux propriétaires (ex. roles page legacy).
 * Uniquement APP_ROLE.OWNER (plateforme) ou ORG_ROLE.OWNER (membre).
 */
export function canAccessOrganizationOwnerSections(
  appRole: string | null | undefined,
  orgMemberRole?: string | null,
): boolean {
  if (isPlatformOwnerRole(appRole)) return true;
  return isOrganizationOwnerMember(orgMemberRole);
}

/** Variante scopée à une organisation (évite un rôle owner d'une autre org). */
export function canAccessOrganizationOwnerSectionsForOrg(
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

/**
 * Partenaires : owner plateforme uniquement (creation / gestion).
 */
export function canAccessOrganizationPartenaires(
  appRole: string | null | undefined,
  _orgMemberRole?: string | null,
): boolean {
  return isPlatformOwnerRole(appRole);
}

/** Variante scopée — même règle : owner plateforme seul. */
export function canAccessOrganizationPartenairesForOrg(
  appRole: string | null | undefined,
  _organizationId: string,
  _membership?: { organizationId: string; role: string } | null,
): boolean {
  return isPlatformOwnerRole(appRole);
}

export function canDeleteSpecificOrganization(
  appRole: string | null | undefined,
  _organizationId: string,
  _membership?: { organizationId: string; role: string } | null,
): boolean {
  return isPlatformOwnerRole(appRole);
}

export function canArchiveSpecificOrganization(
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

const organizationSelect = {
  id: true,
  name: true,
  slug: true,
  createdAt: true,
  isArchived: true,
} as const;

export async function listOrganizationsForUser(
  userId: string,
  appRole: string | null | undefined,
): Promise<OrganizationSummary[]> {
  if (canListAllOrganizations(appRole)) {
    return prisma.organization.findMany({
      select: organizationSelect,
      orderBy: { createdAt: "asc" },
    });
  }

  const memberships = await prisma.member.findMany({
    where: { userId },
    select: {
      organization: {
        select: organizationSelect,
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
    select: organizationSelect,
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
      canArchive: canArchiveSpecificOrganization(
        appRole,
        organization.id,
        membership,
      ),
    })),
    membership,
    canCreate: canCreateOrganization(appRole),
    canDelete: canDeleteOrganization(appRole, membership?.role),
    canArchive: canArchiveOrganization(appRole, membership?.role),
    canListAll: canListAllOrganizations(appRole),
    isPlatformOwner: isPlatformOwnerRole(appRole),
    isOrgManager: isAppAdminRole(appRole),
    roleLabel: getOrganizationAccessRoleLabel(appRole, membership?.role),
    membershipRole: membership?.role ?? null,
    membershipOrganizationId: membership?.organizationId ?? null,
  };
}
