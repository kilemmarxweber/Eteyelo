import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getOrganizationAccessAction } from "@/app/admin/organizations/actions";
import { OrganizationHomeView } from "./organization-home-view";
import { auth } from "@/lib/auth";
import { getUserOrganizationMembership } from "@/lib/auth/org-membership";
import { enforceOrganizationManagerPage } from "@/lib/auth/require-organization-permission";
import {
  BRANCH_LOGIN_ORG_ROLES,
  resolveActiveBranchId,
} from "@/lib/auth/user-branch-access";

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

  const isBranchLoginRole = splitRoles(membership?.role).some((role) =>
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

  await enforceOrganizationManagerPage(organizationId);

  const access = await getOrganizationAccessAction(organizationId);
  if (!access) {
    notFound();
  }

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
      roleLabel={access.roleLabel}
    />
  );
}
