"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  listAccessibleOrganizationMemberships,
} from "@/lib/auth/org-membership";
import {
  getUserBranchMembershipsForLogin,
  resolveActiveBranchId,
} from "@/lib/auth/user-branch-access";
import { resolveMembershipPostLoginPath } from "@/lib/auth/post-login-routing";
import { setActiveOrganizationAndBranch } from "@/lib/auth/set-active-context";

export async function selectOrganizationForSessionAction(
  organizationId: string,
): Promise<{ ok: true; path: string } | { ok: false; message: string }> {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session?.user?.id) {
    return { ok: false, message: "Session introuvable." };
  }

  const memberships = await listAccessibleOrganizationMemberships(
    session.user.id,
  );
  const membership = memberships.find(
    (item) => item.organizationId === organizationId,
  );

  if (!membership) {
    return {
      ok: false,
      message:
        "Organisation inaccessible (archivée, désactivée ou hors de vos accès).",
    };
  }

  const branchMemberships = await getUserBranchMembershipsForLogin(
    session.user.id,
    organizationId,
    membership.role,
  );
  const branchId = await resolveActiveBranchId(
    session.user.id,
    organizationId,
    null,
    membership.role,
  );

  await setActiveOrganizationAndBranch({
    organizationId,
    branchId,
    userId: session.user.id,
    appRole: session.user.role,
    sessionId: session.session.id,
    requestHeaders: h,
  });

  const path = resolveMembershipPostLoginPath({
    organizationId,
    membershipRole: membership.role,
    branchId,
    branchCount: branchMemberships.length,
  });

  return { ok: true, path };
}
