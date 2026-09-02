import {
  SETTINGS_HREF_BRANCH_AREA,
  SIDEBAR_HREF_BRANCH_AREA,
} from "@/lib/auth/branch-area-permissions";

export type BranchWorkspacePath = {
  organizationId: string;
  branchId: string;
  dashboardHref: string;
  logicalHref: string;
  settingsSegment: string | null;
  isDashboard: boolean;
};

export function parseBranchWorkspacePath(
  pathname: string,
): BranchWorkspacePath | null {
  const match = pathname.match(
    /^\/admin\/organizations\/([^/]+)\/branches\/([^/]+)(?:\/(.*))?$/,
  );
  if (!match) return null;

  const organizationId = match[1];
  const branchId = match[2];
  if (["new", "edit", "enter"].includes(branchId)) return null;

  const segments = (match[3] ?? "").split("/").filter(Boolean);
  const first = segments[0] ?? "";

  return {
    organizationId,
    branchId,
    dashboardHref: `/admin/organizations/${organizationId}/branches/${branchId}`,
    logicalHref: first ? `/admin/${first}` : "/admin",
    settingsSegment: first === "settings" ? (segments[1] ?? null) : null,
    isDashboard: segments.length === 0,
  };
}

export function pageStillAllowedAfterGrantExpiry(
  parsed: BranchWorkspacePath,
  flags: {
    hideHrefs: string[];
    settingsReads: Record<string, boolean>;
  },
) {
  if (parsed.isDashboard) return true;

  if (parsed.settingsSegment) {
    if (
      Object.prototype.hasOwnProperty.call(
        SETTINGS_HREF_BRANCH_AREA,
        parsed.settingsSegment,
      )
    ) {
      return Boolean(flags.settingsReads[parsed.settingsSegment]);
    }
    return true;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      SIDEBAR_HREF_BRANCH_AREA,
      parsed.logicalHref,
    )
  ) {
    return !flags.hideHrefs.includes(parsed.logicalHref);
  }

  return true;
}
