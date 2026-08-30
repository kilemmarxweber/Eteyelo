import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getOrganizationAccessAction } from "@/app/admin/organizations/actions";
import { OrganizationHomeView } from "./organization-home-view";
import { auth } from "@/lib/auth";
import { getUserOrganizationMembership } from "@/lib/auth/org-membership";
import { enforceOrganizationManagerPage } from "@/lib/auth/require-organization-permission";
import {
  BRANCH_LOGIN_ORG_ROLES,
  buildGestionnaireLandingPath,
  isGestionnaireBranchLandingRole,
  resolveActiveBranchId,
} from "@/lib/auth/user-branch-access";
import { ORG_ROLE } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function splitRoles(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

export default async function AdminOrganizationHomePage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  const membership =
    session?.user?.id != null
      ? await getUserOrganizationMembership(session.user.id)
      : null;

  const membershipRoles = splitRoles(membership?.role);

  // Support établissement : workspace tickets / escalades (pas le hub manager).
  if (membershipRoles.includes(ORG_ROLE.SUPPORT)) {
    redirect(`/admin/organizations/${organizationId}/support`);
  }

  const isBranchLoginRole = membershipRoles.some((role) =>
    BRANCH_LOGIN_ORG_ROLES.has(role),
  );

  // Caissier / enseignant / parent / élève : jamais l'accueil org (404 manager).
  if (isBranchLoginRole && session?.user?.id) {
    const branchId = await resolveActiveBranchId(
      session.user.id,
      organizationId,
      session.session.activeBranchId,
      membership?.role,
    );
    if (branchId) {
      redirect(
        `/admin/organizations/${organizationId}/branches/${branchId}`,
      );
    }
  }

  const context = await enforceOrganizationManagerPage(organizationId);

  // Gestionnaire : entre directement dans la (les) branche(s) qu’il gère.
  if (
    isGestionnaireBranchLandingRole(
      context.membership?.role ?? membership?.role,
    ) &&
    session?.user?.id
  ) {
    const branchId = await resolveActiveBranchId(
      session.user.id,
      organizationId,
      session.session.activeBranchId,
      context.membership?.role ?? membership?.role,
    );
    redirect(buildGestionnaireLandingPath(organizationId, branchId));
  }

  const access = await getOrganizationAccessAction(organizationId);
  if (!access) {
    notFound();
  }

  const [branchesCount, membersCount, organizationFlags] = await Promise.all([
    prisma.branch.count({ where: { organizationId } }),
    prisma.member.count({ where: { organizationId } }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { messagingEnabled: true },
    }),
  ]);

  return (
    <OrganizationHomeView
      organizationId={organizationId}
      organization={{
        id: access.organization.id,
        name: access.organization.name,
        slug: access.organization.slug,
      }}
      canDelete={access.canDelete}
      canListAll={access.canListAll}
      canViewMembers={access.canViewMembers}
      roleLabel={access.roleLabel}
      counts={{
        branches: branchesCount,
        members: membersCount,
      }}
      messagingEnabled={organizationFlags?.messagingEnabled !== false}
    />
  );
}
