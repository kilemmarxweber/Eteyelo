import { auth } from "@/lib/auth";
import {
  listAccessibleOrganizationMemberships,
} from "@/lib/auth/org-membership";
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

export const ORGANIZATION_PICKER_PATH = "/admin/organization-picker";

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

async function resolvePathForMembership(input: {
  requestHeaders: Headers;
  sessionId: string;
  userId: string;
  appRole: string;
  organizationId: string;
  membershipRole: string;
}) {
  const branchMemberships = await getUserBranchMembershipsForLogin(
    input.userId,
    input.organizationId,
    input.membershipRole,
  );
  const branchId = await resolveActiveBranchId(
    input.userId,
    input.organizationId,
    null,
    input.membershipRole,
  );

  await setActiveOrganizationContext(
    input.requestHeaders,
    input.organizationId,
    branchId,
    input.sessionId,
    input.userId,
    input.appRole,
  );

  return resolveMembershipPostLoginPath({
    organizationId: input.organizationId,
    membershipRole: input.membershipRole,
    branchId,
    branchCount: branchMemberships.length,
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
    return "/auth/change-password";
  }

  const appRole = normalizeRole(session.user.role);
  const staticPath = resolveStaticAppRolePostLoginPath(appRole);
  if (staticPath) {
    return staticPath;
  }

  const memberships = await listAccessibleOrganizationMemberships(
    session.user.id,
  );

  if (appRole === APP_ROLE.ADMIN) {
    if (memberships.length === 0) {
      return resolveAppAdminPostLoginPath(null);
    }
    if (memberships.length > 1) {
      return ORGANIZATION_PICKER_PATH;
    }

    const only = memberships[0];
    await setActiveOrganizationContext(
      requestHeaders,
      only.organizationId,
      null,
      session.session.id,
      session.user.id,
      appRole,
    );

    return resolveAppAdminPostLoginPath(only.organizationId);
  }

  if (memberships.length === 0) {
    return "/admin/no-organization";
  }

  if (memberships.length > 1) {
    return ORGANIZATION_PICKER_PATH;
  }

  const only = memberships[0];
  return resolvePathForMembership({
    requestHeaders,
    sessionId: session.session.id,
    userId: session.user.id,
    appRole,
    organizationId: only.organizationId,
    membershipRole: only.role,
  });
}
