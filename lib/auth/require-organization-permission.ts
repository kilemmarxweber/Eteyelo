import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessOrganization } from "@/lib/auth/organization-access";
import { getUserOrganizationMembership } from "@/lib/auth/org-membership";
import { BRANCH_LOGIN_ORG_ROLES } from "@/lib/auth/user-branch-access";
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

const ORG_MANAGER_MEMBER_ROLES = new Set<string>([
  ORG_ROLE.OWNER,
  ORG_ROLE.GESTIONNAIRE,
  ORG_ROLE.PREFET,
  ORG_ROLE.DIRECTEUR,
  ORG_ROLE.SUPERVISEUR,
]);

function splitRoles(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

export function isOrganizationManagerMember(role: string | null | undefined) {
  return splitRoles(role).some((memberRole) =>
    ORG_MANAGER_MEMBER_ROLES.has(memberRole),
  );
}

export async function getOrganizationAuthContext(): Promise<OrganizationAuthContext | null> {
  const session = await auth.api.getSession({ headers: await headers() });
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
}

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
        "Suppression reservee au owner plateforme. Le proprietaire peut archiver l'organisation.",
    };
  }

  return { ok: true, context: access.context };
}

/** Archivage / reactivation : owner plateforme ou propriétaire org. */
export async function guardOrganizationArchive(
  organizationId: string,
): Promise<OrganizationGuardResult> {
  return guardOrganizationOwner(organizationId);
}

export async function guardOrganizationBranchAccess(
  organizationId: string,
  branchId: string,
): Promise<OrganizationGuardResult> {
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

  const membership = await getMembershipForOrganization(
    context.userId,
    organizationId,
  );

  if (membership && isOrganizationManagerMember(membership.role)) {
    return { ok: true, context };
  }

  // Caissier / enseignant / parent / élève : accès à la branche de leur org.
  if (
    membership &&
    splitRoles(membership.role).some((role) => BRANCH_LOGIN_ORG_ROLES.has(role))
  ) {
    if (branch.isActive) {
      return { ok: true, context };
    }
  }

  const branchMember = await prisma.branchMember.findFirst({
    where: {
      branchId,
      branch: { organizationId },
      member: {
        userId: context.userId,
        organizationId,
      },
    },
    select: { id: true },
  });

  if (!branchMember) {
    return { ok: false, message: "Acces a cette branche refuse." };
  }

  return { ok: true, context };
}

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

  if (isPlatformOwnerRole(context.appRole) || isAppAdminRole(context.appRole)) {
    return context;
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
