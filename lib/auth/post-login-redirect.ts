import { auth } from "@/lib/auth";
import { getUserOrganizationMembership } from "@/lib/auth/org-membership";
import {
  getUserBranchMemberships,
  resolveActiveBranchId,
} from "@/lib/auth/user-branch-access";
import {
  resolveAppAdminPostLoginPath,
  resolveMembershipPostLoginPath,
  resolveStaticAppRolePostLoginPath,
} from "@/lib/auth/post-login-routing";
import { APP_ROLE } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function normalizeRole(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

async function setActiveOrganizationContext(
  requestHeaders: Headers,
  organizationId: string,
  branchId?: string | null,
  sessionId?: string | null,
) {
  await auth.api.setActiveOrganization({
    body: { organizationId },
    headers: requestHeaders,
  });

  if (sessionId) {
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        activeOrganizationId: organizationId,
        activeBranchId: branchId ?? null,
      },
    });
  }
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
    );

    return resolveAppAdminPostLoginPath(membership.organizationId);
  }

  if (!membership) {
    return "/admin/no-organization";
  }

  const branchMemberships = await getUserBranchMemberships(
    session.user.id,
    membership.organizationId,
  );
  const branchId = await resolveActiveBranchId(
    session.user.id,
    membership.organizationId,
    session.session.activeBranchId,
  );

  if (branchId) {
    await setActiveOrganizationContext(
      requestHeaders,
      membership.organizationId,
      branchId,
      session.session.id,
    );
  } else if (branchMemberships.length > 1) {
    await setActiveOrganizationContext(
      requestHeaders,
      membership.organizationId,
      null,
      session.session.id,
    );
  } else {
    await setActiveOrganizationContext(
      requestHeaders,
      membership.organizationId,
      null,
      session.session.id,
    );
  }

  return resolveMembershipPostLoginPath({
    organizationId: membership.organizationId,
    membershipRole: membership.role,
    branchId,
    branchCount: branchMemberships.length,
  });
}
