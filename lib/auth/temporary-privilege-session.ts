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

function longestSidebarHref(segments: string[]): string {
  if (segments.length === 0) return "/admin";

  const candidate = `/admin/${segments.join("/")}`;
  const keys = Object.keys(SIDEBAR_HREF_BRANCH_AREA).sort(
    (a, b) => b.length - a.length,
  );

  for (const key of keys) {
    if (candidate === key || candidate.startsWith(`${key}/`)) {
      return key;
    }
  }

  return `/admin/${segments[0]}`;
}

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
  const settingsSegment = first === "settings" ? (segments[1] ?? null) : null;

  return {
    organizationId,
    branchId,
    dashboardHref: `/admin/organizations/${organizationId}/branches/${branchId}`,
    logicalHref: settingsSegment
      ? `/admin/settings`
      : first
        ? longestSidebarHref(segments)
        : "/admin",
    settingsSegment,
    isDashboard: segments.length === 0,
  };
}

/** Page octroyée (menu / settings DAC) — hors dashboard. */
export function isGrantedWorkspacePage(parsed: BranchWorkspacePath): boolean {
  if (parsed.isDashboard) return false;

  if (parsed.settingsSegment) {
    return Object.prototype.hasOwnProperty.call(
      SETTINGS_HREF_BRANCH_AREA,
      parsed.settingsSegment,
    );
  }

  return Object.prototype.hasOwnProperty.call(
    SIDEBAR_HREF_BRANCH_AREA,
    parsed.logicalHref,
  );
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
