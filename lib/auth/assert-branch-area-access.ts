import "server-only";

import { notFound, redirect } from "next/navigation";

import {
  canAccessBranchArea,
  type BranchArea,
} from "@/lib/auth/branch-area-access";
import { getCachedSession } from "@/lib/auth/get-session-cached";

export type { BranchArea };
export { canAccessBranchArea };

export type AssertBranchAreaOptions = {
  /**
   * `redirect` → dashboard branche (défaut si org+branch connus).
   * `notFound` → 404 (comportement historique de nombreuses pages).
   */
  onDeny?: "redirect" | "notFound";
  organizationId?: string | null;
  branchId?: string | null;
};

function resolveBranchHome(
  session: any,
  organizationId?: string | null,
  branchId?: string | null,
): string | null {
  const orgId =
    organizationId ??
    session?.organization?.id ??
    session?.session?.activeOrganizationId;
  const brId =
    branchId ?? session?.branch?.id ?? session?.session?.activeBranchId;

  if (!orgId || !brId) return null;
  return `/admin/organizations/${orgId}/branches/${brId}`;
}

/**
 * Refuse l’accès serveur à une zone branche.
 * Préférer cet helper aux checks ad hoc dans chaque page/layout.
 */
export async function assertBranchAreaAccess(
  area: BranchArea,
  session?: unknown | null,
  options?: AssertBranchAreaOptions,
): Promise<NonNullable<Awaited<ReturnType<typeof getCachedSession>>>> {
  const resolved =
    session === undefined || session === null
      ? await getCachedSession()
      : session;

  if (!resolved || !(resolved as { user?: { id?: string } }).user?.id) {
    redirect("/auth/sign-in");
  }

  if (canAccessBranchArea(area, resolved)) {
    return resolved as NonNullable<Awaited<ReturnType<typeof getCachedSession>>>;
  }

  const onDeny =
    options?.onDeny ??
    (resolveBranchHome(
      resolved,
      options?.organizationId,
      options?.branchId,
    )
      ? "redirect"
      : "notFound");

  if (onDeny === "redirect") {
    const home = resolveBranchHome(
      resolved,
      options?.organizationId,
      options?.branchId,
    );
    if (home) redirect(home);
  }

  notFound();
}
