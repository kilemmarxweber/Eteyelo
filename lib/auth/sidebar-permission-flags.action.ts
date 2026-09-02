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
  canAccessSchoolStructureSettings,
  canAccessSupportSettings,
  isOrganizationOwnerSession,
} from "@/lib/auth/session-roles";
import {
  grantsCoverBranchArea,
  loadActiveTemporaryGrants,
  expireOutdatedGrants,
} from "@/lib/auth/temporary-privilege";
import { prisma } from "@/lib/prisma";

export type SidebarPermissionFlagsInput = {
  organizationId?: string | null;
  branchId?: string | null;
};

export type SidebarPermissionFlags = {
  /** Hrefs logiques `/admin/...` à masquer (sans `resource:read`). */
  hideHrefs: string[];
  /** Segments settings (`typeFrais`, `roles`, …) autorisés via Voir. */
  settingsReads: Record<string, boolean>;
  inscriptionRead: boolean;
  /** true = ne pas utiliser les rôles statiques legacy pour filtrer le menu branche. */
  dacStrictMenu: boolean;
};

function defaultSettingsReads(allAllowed: boolean): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const key of Object.keys(SETTINGS_HREF_BRANCH_AREA)) {
    out[key] = allAllowed;
  }
  return out;
}

/**
 * Flags menu sidebar / settings pilotés par OrganizationRole (Voir = entrée)
 * + octrois temporaires actifs uniquement.
 */
export async function getSidebarPermissionFlagsAction(
  input?: SidebarPermissionFlagsInput,
): Promise<SidebarPermissionFlags> {
  const empty: SidebarPermissionFlags = {
    hideHrefs: Object.keys(SIDEBAR_HREF_BRANCH_AREA),
    settingsReads: defaultSettingsReads(false),
    inscriptionRead: false,
    dacStrictMenu: isPermissionsFromDacEnabled(),
  };

  const session = await getCachedSession();
  if (!session?.user?.id) {
    return empty;
  }

  const organizationId =
    input?.organizationId ??
    session.organization?.id ??
    session.session?.activeOrganizationId ??
    null;

  if (!organizationId) {
    return empty;
  }

  const branchId =
    input?.branchId ??
    session.branch?.id ??
    session.session?.activeBranchId ??
    null;

  await expireOutdatedGrants();

  // Propriétaire org / plateforme / branche : tous les menus (hors directeur etc.).
  if (isOrganizationOwnerSession(session)) {
    return {
      hideHrefs: await hideMessagingIfDisabled(organizationId, []),
      settingsReads: defaultSettingsReads(true),
      inscriptionRead: true,
      dacStrictMenu: false,
    };
  }

  if (isPermissionsFromDacEnabled()) {
    const roleStatements = await loadOrganizationRoleStatements(organizationId);
    const temporaryGrants = await loadActiveTemporaryGrants(
      session.user.id,
      organizationId,
      branchId,
    );

    const hideHrefs: string[] = [];
    for (const [href, area] of Object.entries(SIDEBAR_HREF_BRANCH_AREA) as Array<
      [string, BranchArea]
    >) {
      const allowedByRole = canAccessBranchAreaFromPermissions(
        area,
        session,
        roleStatements,
      );
      const allowedByGrant = grantsCoverBranchArea(temporaryGrants, area);
      if (!allowedByRole && !allowedByGrant) hideHrefs.push(href);
    }

    const settingsReads: Record<string, boolean> = {};
    for (const [segment, area] of Object.entries(SETTINGS_HREF_BRANCH_AREA) as Array<
      [string, BranchArea]
    >) {
      const allowedByRole = canAccessBranchAreaFromPermissions(
        area,
        session,
        roleStatements,
      );
      settingsReads[segment] =
        allowedByRole || grantsCoverBranchArea(temporaryGrants, area);
    }

    return {
      hideHrefs: await hideMessagingIfDisabled(organizationId, hideHrefs),
      settingsReads,
      inscriptionRead: !hideHrefs.includes("/admin/registration"),
      dacStrictMenu: true,
    };
  }

  const settingsReads = defaultSettingsReads(false);
  settingsReads.roles = isOrganizationOwnerSession(session);
  settingsReads.typeFrais = canAccessBranchOrgSettings(session);
  settingsReads["exchange-rates"] = canAccessBranchOrgSettings(session);
  settingsReads.whatsapp = canAccessBranchOrgSettings(session);
  settingsReads.messagerie = canAccessBranchOrgSettings(session);
  settingsReads.attendance = canAccessBranchOrgSettings(session);
  settingsReads["inscription-publique"] = canAccessSchoolOpsSettings(session);
  settingsReads.calendar = canAccessSchoolOpsSettings(session);
  settingsReads.periodes = canAccessSchoolOpsSettings(session);
  settingsReads["annee-scolaire"] = canAccessSchoolStructureSettings(session);
  settingsReads["structure-merge"] = canAccessSchoolStructureSettings(session);
  settingsReads["primary-domains"] = canAccessSchoolStructureSettings(session);
  settingsReads.support = canAccessSupportSettings(session);

  return {
    hideHrefs: await hideMessagingIfDisabled(
      organizationId,
      canAccessRegistrationArea(session) ? [] : ["/admin/registration"],
    ),
    settingsReads,
    inscriptionRead: canAccessRegistrationArea(session),
    dacStrictMenu: false,
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
