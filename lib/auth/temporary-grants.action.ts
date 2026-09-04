"use server";

import { getOrganizationAuthContext } from "@/lib/auth/require-organization-permission";
import { getSidebarPermissionFlagsAction } from "@/lib/auth/sidebar-permission-flags.action";
import {
  isGrantedWorkspacePage,
  pageStillAllowedAfterGrantExpiry,
  parseBranchWorkspacePath,
} from "@/lib/auth/temporary-privilege-session";
import { getUserActiveTemporaryGrants } from "@/lib/auth/temporary-privilege";

export async function getMyActiveTemporaryGrantsAction(
  organizationId?: string,
  branchId?: string | null,
) {
  const context = await getOrganizationAuthContext();
  if (!context) {
    return { ok: false as const, grants: [] };
  }

  try {
    const grants = await getUserActiveTemporaryGrants(
      context.userId,
      organizationId,
      branchId ??
        context.session?.branch?.id ??
        context.session?.session?.activeBranchId ??
        null,
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
    return {
      leave: isGrantedWorkspacePage(parsed),
      dashboardHref: parsed.dashboardHref,
    };
  }
}
