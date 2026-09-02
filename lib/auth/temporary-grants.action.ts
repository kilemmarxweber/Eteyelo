"use server";

import { getOrganizationAuthContext } from "@/lib/auth/require-organization-permission";
import { getSidebarPermissionFlagsAction } from "@/lib/auth/sidebar-permission-flags.action";
import {
  pageStillAllowedAfterGrantExpiry,
  parseBranchWorkspacePath,
} from "@/lib/auth/temporary-privilege-session";
import { getUserActiveTemporaryGrants } from "@/lib/auth/temporary-privilege";

export async function getMyActiveTemporaryGrantsAction(organizationId?: string) {
  const context = await getOrganizationAuthContext();
  if (!context) {
    return { ok: false as const, grants: [] };
  }

  try {
    const grants = await getUserActiveTemporaryGrants(
      context.userId,
      organizationId,
    );
    return { ok: true as const, grants };
  } catch (error) {
    console.error("Erreur chargement mes privilèges temporaires:", error);
    return { ok: false as const, grants: [] };
  }
}

export async function shouldLeavePageAfterGrantExpiryAction(pathname: string) {
  const parsed = parseBranchWorkspacePath(pathname);
  if (!parsed) {
    return { leave: false, dashboardHref: null as string | null };
  }

  if (parsed.isDashboard) {
    return { leave: false, dashboardHref: parsed.dashboardHref };
  }

  try {
    const flags = await getSidebarPermissionFlagsAction({
      organizationId: parsed.organizationId,
      branchId: parsed.branchId,
    });
    return {
      leave: !pageStillAllowedAfterGrantExpiry(parsed, flags),
      dashboardHref: parsed.dashboardHref,
    };
  } catch {
    return { leave: true, dashboardHref: parsed.dashboardHref };
  }
}
