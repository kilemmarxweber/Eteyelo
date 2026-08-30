"use server";

import { getCachedSession } from "@/lib/auth/get-session-cached";
import { loadOrganizationRoleStatements } from "@/lib/auth/org-role-permissions";
import { canAccessBranchAreaFromPermissions } from "@/lib/auth/resolve-branch-area-permission";
import {
  isPermissionsFromDacEnabled,
  SETTINGS_HREF_BRANCH_AREA,
  SIDEBAR_HREF_BRANCH_AREA,
  type BranchArea,
} from "@/lib/auth/branch-area-permissions";
import {
  canAccessBranchOrgSettings,
  canAccessRegistrationArea,
  canAccessSchoolOpsSettings,
  canAccessSupportSettings,
  isOrganizationOwnerSession,
} from "@/lib/auth/session-roles";
import { prisma } from "@/lib/prisma";

export type SidebarPermissionFlags = {
  /** Hrefs logiques `/admin/...` à masquer (sans `resource:read`). */
  hideHrefs: string[];
  /** Segments settings (`typeFrais`, `roles`, …) autorisés via Voir. */
  settingsReads: Record<string, boolean>;
  inscriptionRead: boolean;
};

function defaultSettingsReads(allAllowed: boolean): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const key of Object.keys(SETTINGS_HREF_BRANCH_AREA)) {
    out[key] = allAllowed;
  }
  return out;
}

/**
 * Flags menu sidebar / settings pilotés par OrganizationRole (Voir = entrée).
 */
export async function getSidebarPermissionFlagsAction(): Promise<SidebarPermissionFlags> {
  const empty: SidebarPermissionFlags = {
    hideHrefs: Object.keys(SIDEBAR_HREF_BRANCH_AREA),
    settingsReads: defaultSettingsReads(false),
    inscriptionRead: false,
  };

  const session = await getCachedSession();
  if (!session?.user?.id) {
    return empty;
  }

  const organizationId =
    session.organization?.id ?? session.session?.activeOrganizationId ?? null;

  if (!organizationId) {
    return empty;
  }

  if (isPermissionsFromDacEnabled()) {
    const roleStatements = await loadOrganizationRoleStatements(organizationId);
    const hideHrefs: string[] = [];
    for (const [href, area] of Object.entries(SIDEBAR_HREF_BRANCH_AREA) as Array<
      [string, BranchArea]
    >) {
      const allowed = canAccessBranchAreaFromPermissions(
        area,
        session,
        roleStatements,
      );
      if (!allowed) hideHrefs.push(href);
    }

    const settingsReads: Record<string, boolean> = {};
    for (const [segment, area] of Object.entries(SETTINGS_HREF_BRANCH_AREA) as Array<
      [string, BranchArea]
    >) {
      settingsReads[segment] = canAccessBranchAreaFromPermissions(
        area,
        session,
        roleStatements,
      );
    }

    return {
      hideHrefs: await hideMessagingIfDisabled(organizationId, hideHrefs),
      settingsReads,
      inscriptionRead: !hideHrefs.includes("/admin/registration"),
    };
  }

  // Legacy session-roles : ne masque pas les menus fins (comportement historique).
  const settingsReads = defaultSettingsReads(false);
  settingsReads.roles = isOrganizationOwnerSession(session);
  settingsReads.typeFrais = canAccessBranchOrgSettings(session);
  settingsReads["exchange-rates"] = canAccessBranchOrgSettings(session);
  settingsReads.whatsapp = canAccessBranchOrgSettings(session);
  settingsReads.messagerie = canAccessBranchOrgSettings(session);
  settingsReads.attendance = canAccessBranchOrgSettings(session);
  settingsReads["inscription-publique"] = canAccessSchoolOpsSettings(session);
  settingsReads.calendar = canAccessSchoolOpsSettings(session);
  settingsReads["annee-scolaire"] = canAccessSchoolOpsSettings(session);
  settingsReads.periodes = canAccessSchoolOpsSettings(session);
  settingsReads["structure-merge"] = canAccessSchoolOpsSettings(session);
  settingsReads.support = canAccessSupportSettings(session);

  return {
    hideHrefs: await hideMessagingIfDisabled(
      organizationId,
      canAccessRegistrationArea(session) ? [] : ["/admin/registration"],
    ),
    settingsReads,
    inscriptionRead: canAccessRegistrationArea(session),
  };
}

async function hideMessagingIfDisabled(
  organizationId: string,
  hideHrefs: string[],
) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { messagingEnabled: true },
  });
  if (org && !org.messagingEnabled && !hideHrefs.includes("/admin/messagerie")) {
    return [...hideHrefs, "/admin/messagerie"];
  }
  return hideHrefs;
}
