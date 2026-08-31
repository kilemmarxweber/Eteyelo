import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { getCachedSession } from "@/lib/auth/get-session-cached";
import { canAccessOrganization } from "@/lib/auth/organization-access";
import { getUserOrganizationMembership } from "@/lib/auth/org-membership";
import { BRANCH_LOGIN_ORG_ROLES } from "@/lib/auth/user-branch-access";
import {
  canArchiveOrganizationAsMember,
  isOrganizationManagerMember,
  memberHasImplicitAllBranchAccess,
} from "@/lib/auth/role-labels";
import { isBranchOwnerSession } from "@/lib/auth/branch-role-access";
import {
  APP_ROLE,
  ORG_ROLE,
  isAppAdminRole,
  isPlatformOwnerRole,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export type OrganizationAuthContext = {
  session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
  userId: string;
  appRole: string;
  membership: Awaited<ReturnType<typeof getUserOrganizationMembership>>;
};

export type OrganizationGuardFailure = {
  ok: false;
  message: string;
};

export type OrganizationGuardSuccess = {
  ok: true;
  context: OrganizationAuthContext;
};

export type OrganizationGuardResult =
  | OrganizationGuardSuccess
  | OrganizationGuardFailure;

function splitRoles(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

export { isOrganizationManagerMember };

export const getOrganizationAuthContext = cache(
  async (): Promise<OrganizationAuthContext | null> => {
    const session = await getCachedSession();
    if (!session?.user?.id) {
      return null;
    }

    const membership = await getUserOrganizationMembership(session.user.id);

    return {
      session,
      userId: session.user.id,
      appRole: session.user.role ?? APP_ROLE.USER,
      membership,
    };
  },
);

async function getMembershipForOrganization(
  userId: string,
  organizationId: string,
) {
  return prisma.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    select: {
      organizationId: true,
      role: true,
      isArchived: true,
      organization: { select: { isArchived: true } },
    },
  }).then((member) => {
    if (!member || member.isArchived || member.organization.isArchived) {
      return null;
    }
    return {
      organizationId: member.organizationId,
      role: member.role,
    };
  });
}

export async function guardPlatformOwner(): Promise<OrganizationGuardResult> {
  const context = await getOrganizationAuthContext();
  if (!context) {
    return { ok: false, message: "Session introuvable." };
  }

  if (!isPlatformOwnerRole(context.appRole)) {
    return {
      ok: false,
      message: "Action reservee au proprietaire plateforme.",
    };
  }

  return { ok: true, context };
}

export async function guardOrganizationAccess(
  organizationId: string,
): Promise<OrganizationGuardResult> {
  const context = await getOrganizationAuthContext();
  if (!context) {
    return { ok: false, message: "Session introuvable." };
  }

  const allowed = await canAccessOrganization(
    context.userId,
    context.appRole,
    organizationId,
  );

  if (!allowed) {
    return { ok: false, message: "Acces a cette organisation refuse." };
  }

  return { ok: true, context };
}

export async function guardOrganizationManager(
  organizationId: string,
): Promise<OrganizationGuardResult> {
  const access = await guardOrganizationAccess(organizationId);
  if (!access.ok) {
    return access;
  }

  const { context } = access;

  if (isPlatformOwnerRole(context.appRole) || isAppAdminRole(context.appRole)) {
    return { ok: true, context };
  }

  const membership =
    context.membership?.organizationId === organizationId
      ? context.membership
      : await getMembershipForOrganization(context.userId, organizationId);

  if (membership && isOrganizationManagerMember(membership.role)) {
    return { ok: true, context };
  }

  return {
    ok: false,
    message: "Action reservee aux gestionnaires de l'organisation.",
  };
}

export async function guardOrganizationOwner(
  organizationId: string,
): Promise<OrganizationGuardResult> {
  const access = await guardOrganizationAccess(organizationId);
  if (!access.ok) {
    return access;
  }

  const { context } = access;

  if (isPlatformOwnerRole(context.appRole)) {
    return { ok: true, context };
  }

  const membership =
    context.membership?.organizationId === organizationId
      ? context.membership
      : await getMembershipForOrganization(context.userId, organizationId);

  if (
    isBranchOwnerSession(context.session) &&
    context.session.branch?.organizationId === organizationId
  ) {
    return { ok: true, context };
  }

  if (splitRoles(membership?.role).includes(ORG_ROLE.OWNER)) {
    return { ok: true, context };
  }

  return {
    ok: false,
    message: "Action reservee au proprietaire de l'organisation.",
  };
}

/**
 * Partenaires : owner plateforme uniquement.
 */
export async function guardOrganizationPartenaires(
  organizationId: string,
): Promise<OrganizationGuardResult> {
  const access = await guardOrganizationAccess(organizationId);
  if (!access.ok) {
    return access;
  }

  const { context } = access;

  if (isPlatformOwnerRole(context.appRole)) {
    return { ok: true, context };
  }

  return {
    ok: false,
    message: "Creation et gestion des partenaires reservees au owner plateforme.",
  };
}

/**
 * Suppression physique : owner plateforme uniquement.
 * Le propriétaire org peut archiver via `guardOrganizationArchive`.
 */
export async function guardOrganizationDelete(
  organizationId: string,
): Promise<OrganizationGuardResult> {
  const access = await guardOrganizationAccess(organizationId);
  if (!access.ok) {
    return access;
  }

  if (!isPlatformOwnerRole(access.context.appRole)) {
    return {
      ok: false,
      message:
        "Suppression reservee au owner plateforme. Le proprietaire ou le gestionnaire peut archiver l'organisation.",
    };
  }

  return { ok: true, context: access.context };
}

/** Archivage / reactivation : owner plateforme, propriétaire org ou gestionnaire. */
export async function guardOrganizationArchive(
  organizationId: string,
): Promise<OrganizationGuardResult> {
  const access = await guardOrganizationAccess(organizationId);
  if (!access.ok) {
    return access;
  }

  const { context } = access;

  if (isPlatformOwnerRole(context.appRole)) {
    return { ok: true, context };
  }

  const membership =
    context.membership?.organizationId === organizationId
      ? context.membership
      : await getMembershipForOrganization(context.userId, organizationId);

  if (canArchiveOrganizationAsMember(membership?.role)) {
    return { ok: true, context };
  }

  return {
    ok: false,
    message:
      "Archivage reserve au proprietaire ou au gestionnaire de l'organisation.",
  };
}

export const guardOrganizationBranchAccess = cache(
  async (
    organizationId: string,
    branchId: string,
  ): Promise<OrganizationGuardResult> => {
  const access = await guardOrganizationAccess(organizationId);
  if (!access.ok) {
    return access;
  }

  const { context } = access;

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, organizationId },
    select: { id: true, isActive: true },
  });

  if (!branch) {
    return { ok: false, message: "Etablissement introuvable." };
  }

  if (isPlatformOwnerRole(context.appRole) || isAppAdminRole(context.appRole)) {
    return { ok: true, context };
  }

  const membership =
    context.membership?.organizationId === organizationId
      ? context.membership
      : await getMembershipForOrganization(context.userId, organizationId);

  if (membership && memberHasImplicitAllBranchAccess(membership.role)) {
    return { ok: true, context };
  }

  const assignedBranches = membership
    ? await prisma.branchMember.findMany({
        where: {
          member: {
            userId: context.userId,
            organizationId,
          },
          branch: { organizationId, isActive: true },
        },
        select: { branchId: true },
      })
    : [];
  const assignedBranchIds = new Set(
    assignedBranches.map((row) => row.branchId),
  );

  if (membership && isOrganizationManagerMember(membership.role)) {
    if (assignedBranchIds.size === 0 || assignedBranchIds.has(branchId)) {
      return { ok: true, context };
    }
    return { ok: false, message: "Acces a cette branche refuse." };
  }

  if (
    membership &&
    splitRoles(membership.role).some((role) => BRANCH_LOGIN_ORG_ROLES.has(role))
  ) {
    if (!branch.isActive) {
      return { ok: false, message: "Acces a cette branche refuse." };
    }
    if (assignedBranchIds.size === 0 || assignedBranchIds.has(branchId)) {
      return { ok: true, context };
    }
    return { ok: false, message: "Acces a cette branche refuse." };
  }

  if (!assignedBranchIds.has(branchId)) {
    return { ok: false, message: "Acces a cette branche refuse." };
  }

  return { ok: true, context };
},
);

export async function enforceOrganizationSectionAccess(organizationId: string) {
  const context = await getOrganizationAuthContext();
  if (!context) {
    redirect("/auth/sign-in");
  }

  if (isPlatformOwnerRole(context.appRole)) {
    return context;
  }

  if (isAppAdminRole(context.appRole)) {
    if (context.membership?.organizationId !== organizationId) {
      notFound();
    }
    return context;
  }

  const hasAccess = await canAccessOrganization(
    context.userId,
    context.appRole,
    organizationId,
  );

  if (!hasAccess) {
    notFound();
  }

  return context;
}

export async function enforceOrganizationManagerPage(organizationId: string) {
  const guard = await guardOrganizationManager(organizationId);
  if (guard.ok) {
    return guard.context;
  }

  const context = await getOrganizationAuthContext();
  if (!context) {
    redirect("/auth/sign-in");
  }

  notFound();
}

export async function enforceOrganizationOwnerPage(organizationId: string) {
  const guard = await guardOrganizationOwner(organizationId);
  if (guard.ok) {
    return guard.context;
  }

  const context = await getOrganizationAuthContext();
  if (!context) {
    redirect("/auth/sign-in");
  }

  notFound();
}

export async function enforceOrganizationPartenairesPage(
  organizationId: string,
) {
  const guard = await guardOrganizationPartenaires(organizationId);
  if (guard.ok) {
    return guard.context;
  }

  const context = await getOrganizationAuthContext();
  if (!context) {
    redirect("/auth/sign-in");
  }

  notFound();
}

export async function enforceOrganizationListPage() {
  const context = await getOrganizationAuthContext();
  if (!context) {
    redirect("/auth/sign-in");
  }

  if (isPlatformOwnerRole(context.appRole)) {
    return context;
  }

  if (isAppAdminRole(context.appRole)) {
    const orgId = context.membership?.organizationId;
    if (orgId) {
      redirect(`/admin/organizations/${orgId}`);
    }
    redirect("/admin/no-organization");
  }

  notFound();
}

export async function enforceOrganizationBranchPage(
  organizationId: string,
  branchId: string,
) {
  const guard = await guardOrganizationBranchAccess(organizationId, branchId);
  if (guard.ok) {
    return guard.context;
  }

  const context = await getOrganizationAuthContext();
  if (!context) {
    redirect("/auth/sign-in");
  }

  notFound();
}

export const requirePlatformOwner = guardPlatformOwner;
export const requireOrganizationAccess = guardOrganizationAccess;
export const requireOrganizationManager = guardOrganizationManager;
export const requireOrganizationOwner = guardOrganizationOwner;
export const requireOrganizationDelete = guardOrganizationDelete;
export const requireOrganizationArchive = guardOrganizationArchive;
