import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  getOrganizationMembership,
  listAccessibleOrganizationMemberships,
} from "@/lib/auth/org-membership";
import { ORGANIZATION_PICKER_PATH } from "@/lib/auth/post-login-redirect";
import { resolveUserOrganizationFallbackPath } from "@/lib/auth/resolve-user-organization-path";
import { getOrganizationAuthContext } from "@/lib/auth/require-organization-permission";
import {
  ORG_ROLE,
  isAppAdminRole,
  isPlatformOwnerRole,
  isPlatformSupportAppRole,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const CHANGE_PASSWORD_PATH = "/auth/change-password";
const LEGACY_CHANGE_PASSWORD_PATH = "/admin/account/change-password";

const UNIVERSAL_ADMIN_PREFIXES = [
  "/admin/account",
  "/admin/settings",
  "/admin/help",
  "/admin/no-organization",
  "/admin/organization-picker",
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

function isChangePasswordPath(pathname: string) {
  return (
    pathname === CHANGE_PASSWORD_PATH ||
    pathname.startsWith(`${CHANGE_PASSWORD_PATH}/`) ||
    pathname === LEGACY_CHANGE_PASSWORD_PATH ||
    pathname.startsWith(`${LEGACY_CHANGE_PASSWORD_PATH}/`)
  );
}

export async function enforceAdminRouteAccess(pathname: string) {
  const context = await getOrganizationAuthContext();
  if (!context) {
    redirect("/auth/sign-in");
  }

  const { appRole, userId } = context;

  const passwordState = await prisma.user.findUnique({
    where: { id: userId },
    select: { mustChangePassword: true },
  });

  if (passwordState?.mustChangePassword) {
    if (!isChangePasswordPath(pathname)) {
      redirect(CHANGE_PASSWORD_PATH);
    }
    return context;
  }

  if (isBranchScopedPath(pathname) || isUniversalAdminPath(pathname)) {
    return context;
  }

  if (isPlatformOwnerRole(appRole)) {
    return context;
  }

  if (isPlatformSupportAppRole(appRole)) {
    if (pathname.startsWith("/admin/platform-support")) {
      return context;
    }
    redirect("/admin/platform-support");
  }

  const accessible = await listAccessibleOrganizationMemberships(userId);
  const fallback = await resolveUserOrganizationFallbackPath(userId, appRole);

  if (accessible.length === 0) {
    if (pathname === "/admin/no-organization") {
      return context;
    }
    redirect("/admin/no-organization");
  }

  if (accessible.length > 1 && pathname === "/admin") {
    redirect(ORGANIZATION_PICKER_PATH);
  }

  if (isAppAdminRole(appRole)) {
    if (pathname === "/admin") {
      redirect(fallback);
    }

    if (!pathname.startsWith("/admin/organizations")) {
      notFound();
    }

    const organizationId = extractOrganizationId(pathname);
    if (organizationId && organizationId !== "new") {
      const orgMembership = await getOrganizationMembership(
        userId,
        organizationId,
      );
      if (!orgMembership) {
        notFound();
      }
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

    const orgMembership = await getOrganizationMembership(
      userId,
      organizationId,
    );
    if (!orgMembership) {
      notFound();
    }

    if (isUserAllowedOrgSubpath(pathname, organizationId)) {
      return context;
    }

    const memberRoles = splitRoles(orgMembership.role);
    if (
      memberRoles.includes(ORG_ROLE.OWNER) ||
      memberRoles.includes(ORG_ROLE.GESTIONNAIRE) ||
      memberRoles.includes(ORG_ROLE.PREFET) ||
      memberRoles.includes(ORG_ROLE.DIRECTEUR) ||
      memberRoles.includes(ORG_ROLE.SUPERVISEUR) ||
      memberRoles.includes(ORG_ROLE.CAISSIER)
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
