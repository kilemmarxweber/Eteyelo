"use server";

import { getCachedSession } from "@/lib/auth/get-session-cached";
import {
  canUseOrganizationBranchesList,
  resolveBranchesNavHref,
} from "@/lib/auth/branches-nav";
import { getUserBranchMembershipsForLogin } from "@/lib/auth/user-branch-access";

export async function getBranchesNavHrefAction(
  organizationId: string,
): Promise<string | null> {
  const orgId = organizationId?.trim();
  if (!orgId) return null;

  const session = await getCachedSession();
  if (!session?.user?.id) return null;

  const useBranchesList = canUseOrganizationBranchesList(session);
  if (useBranchesList) {
    return resolveBranchesNavHref({
      organizationId: orgId,
      useBranchesList: true,
      accessibleBranchCount: 0,
    });
  }

  const memberships = await getUserBranchMembershipsForLogin(
    session.user.id,
    orgId,
    session.organization?.role,
  );

  return resolveBranchesNavHref({
    organizationId: orgId,
    useBranchesList: false,
    accessibleBranchCount: memberships.length,
  });
}
