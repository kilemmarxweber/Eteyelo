import { auth } from "@/lib/auth";
import { getUserOrganizationMembership } from "@/lib/auth/org-membership";
import {
  getUserBranchMembershipsForLogin,
  resolveActiveBranchId,
} from "@/lib/auth/user-branch-access";
import {
  resolveAppAdminPostLoginPath,
  resolveMembershipPostLoginPath,
  resolveStaticAppRolePostLoginPath,
} from "@/lib/auth/post-login-routing";
import { setActiveOrganizationAndBranch } from "@/lib/auth/set-active-context";
import { APP_ROLE } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function normalizeRole(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

async function setActiveOrganizationContext(
  requestHeaders: Headers,
  organizationId: string,
  branchId: string | null | undefined,
  sessionId: string,
  userId: string,
  appRole: string | null | undefined,
) {
  await setActiveOrganizationAndBranch({
    organizationId,
    branchId: branchId ?? null,
    userId,
    appRole,
    sessionId,
    requestHeaders,
  });
}

export async function resolvePostLoginPath(requestHeaders: Headers): Promise<string> {
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    return "/auth/sign-in";
  }

  const passwordState = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mustChangePassword: true },
  });
  if (passwordState?.mustChangePassword) {
    return "/admin/account/change-password";
  }

  const appRole = normalizeRole(session.user.role);
  const staticPath = resolveStaticAppRolePostLoginPath(appRole);
  if (staticPath) {
    return staticPath;
  }

  const membership = await getUserOrganizationMembership(session.user.id);

  if (appRole === APP_ROLE.ADMIN) {
    if (!membership) {
      return resolveAppAdminPostLoginPath(null);
    }

    await setActiveOrganizationContext(
      requestHeaders,
      membership.organizationId,
      null,
      session.session.id,
      session.user.id,
      appRole,
    );

    return resolveAppAdminPostLoginPath(membership.organizationId);
  }

  if (!membership) {
    return "/admin/no-organization";
  }

  const branchMemberships = await getUserBranchMembershipsForLogin(
    session.user.id,
    membership.organizationId,
    membership.role,
  );
  const branchId = await resolveActiveBranchId(
    session.user.id,
    membership.organizationId,
    session.session.activeBranchId,
    membership.role,
  );

  await setActiveOrganizationContext(
    requestHeaders,
    membership.organizationId,
    branchId,
    session.session.id,
    session.user.id,
    appRole,
  );

  return resolveMembershipPostLoginPath({
    organizationId: membership.organizationId,
    membershipRole: membership.role,
    branchId,
    branchCount: branchMemberships.length,
  });
}
