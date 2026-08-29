"use server";

import { getCachedSession } from "@/lib/auth/get-session-cached";
import { loadOrganizationRoleStatements } from "@/lib/auth/org-role-permissions";
import { canAccessBranchAreaFromPermissions } from "@/lib/auth/resolve-branch-area-permission";
import { isPermissionsFromDacEnabled } from "@/lib/auth/branch-area-permissions";
import { canAccessRegistrationArea } from "@/lib/auth/session-roles";

/**
 * Flags menu sidebar pilotés par OrganizationRole (ex. Inscription · Voir).
 */
export async function getSidebarPermissionFlagsAction(): Promise<{
  inscriptionRead: boolean;
}> {
  const session = await getCachedSession();
  if (!session?.user?.id) {
    return { inscriptionRead: false };
  }

  const organizationId =
    session.organization?.id ?? session.session?.activeOrganizationId ?? null;

  if (!organizationId) {
    return { inscriptionRead: false };
  }

  if (isPermissionsFromDacEnabled()) {
    const roleStatements = await loadOrganizationRoleStatements(organizationId);
    return {
      inscriptionRead: canAccessBranchAreaFromPermissions(
        "registration",
        session,
        roleStatements,
      ),
    };
  }

  return {
    inscriptionRead: canAccessRegistrationArea(session),
  };
}
