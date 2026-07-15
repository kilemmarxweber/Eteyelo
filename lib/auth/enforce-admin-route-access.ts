import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getUserOrganizationMembership } from "@/lib/auth/org-membership";
import { resolveUserOrganizationFallbackPath } from "@/lib/auth/resolve-user-organization-path";
import { getOrganizationAuthContext } from "@/lib/auth/require-organization-permission";
import {
  APP_ROLE,
  ORG_ROLE,
  isAppAdminRole,
  isPlatformOwnerRole,
  isPlatformSupportAppRole,
} from "@/lib/permissions";

const UNIVERSAL_ADMIN_PREFIXES = [
  "/admin/account",
  "/admin/settings",
  "/admin/help",
] as const;

const USER_ORG_PREFIXES = ["/ecodim", "/support", "/branch-picker"] as const;

function splitRoles(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

function isUniversalAdminPath(pathname: string) {
  return UNIVERSAL_ADMIN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isBranchScopedPath(pathname: string) {
  return /\/branches\/[^/]+/.test(pathname);
}

function extractOrganizationId(pathname: string) {
  return pathname.match(/^\/admin\/organizations\/([^/]+)/)?.[1] ?? null;
}

function isUserAllowedOrgSubpath(pathname: string, organizationId: string) {
  const base = `/admin/organizations/${organizationId}`;
  if (!pathname.startsWith(base)) return false;

  const suffix = pathname.slice(base.length);
  return USER_ORG_PREFIXES.some(
    (prefix) => suffix === prefix || suffix.startsWith(`${prefix}/`),
  );
}

export async function enforceAdminRouteAccess(pathname: string) {
  const context = await getOrganizationAuthContext();
  if (!context) {
    redirect("/auth/sign-in");
  }

  if (isBranchScopedPath(pathname) || isUniversalAdminPath(pathname)) {
    return context;
  }

  const { appRole, userId } = context;

  if (isPlatformOwnerRole(appRole)) {
    return context;
  }

  if (isPlatformSupportAppRole(appRole)) {
    if (pathname.startsWith("/admin/platform-support")) {
      return context;
    }
    redirect("/admin/platform-support");
  }

  const membership = await getUserOrganizationMembership(userId);
  const fallback = await resolveUserOrganizationFallbackPath(userId, appRole);

  if (isAppAdminRole(appRole)) {
    if (pathname === "/admin") {
      redirect(fallback);
    }

    if (!pathname.startsWith("/admin/organizations")) {
      notFound();
    }

    const organizationId = extractOrganizationId(pathname);
    if (
      organizationId &&
      organizationId !== "new" &&
      membership &&
      organizationId !== membership.organizationId
    ) {
      notFound();
    }

    return context;
  }

  if (pathname === "/admin") {
    redirect(fallback);
  }

  if (pathname.startsWith("/admin/platform-support")) {
    notFound();
  }

  if (pathname.startsWith("/admin/organizations")) {
    const organizationId = extractOrganizationId(pathname);

    if (!organizationId || organizationId === "new") {
      notFound();
    }

    if (membership?.organizationId !== organizationId) {
      notFound();
    }

    if (isUserAllowedOrgSubpath(pathname, organizationId)) {
      return context;
    }

    const memberRoles = splitRoles(membership?.role);
    if (
      memberRoles.includes(ORG_ROLE.OWNER) ||
      memberRoles.includes(ORG_ROLE.GESTIONNAIRE)
    ) {
      return context;
    }

    notFound();
  }

  if (pathname.startsWith("/admin")) {
    notFound();
  }

  return context;
}

export async function enforceAdminRouteAccessFromHeaders() {
  const pathname = (await headers()).get("x-pathname") ?? "/admin";
  return enforceAdminRouteAccess(pathname);
}
