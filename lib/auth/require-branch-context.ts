import { redirect } from "next/navigation";

import { getCachedSession } from "@/lib/auth/get-session-cached";
import {
  canAccessFinanceArea,
  canManageHrDirectory,
} from "@/lib/auth/session-roles";
import { prisma } from "@/lib/prisma";

type RequireBranchContextOptions = {
  /**
   * En RSC, préférer redirect plutôt qu'un throw brut
   * (message générique « Server Components » en production).
   */
  onMissing?: "throw" | "redirect";
};

export async function requireBranchContext(
  options?: RequireBranchContextOptions,
) {
  const onMissing = options?.onMissing ?? "throw";
  const session = await getCachedSession();

  const userId = session?.user?.id;
  const organizationId =
    session?.organization?.id ?? session?.session?.activeOrganizationId;
  const branchId = session?.branch?.id ?? session?.session?.activeBranchId;

  if (!userId) {
    if (onMissing === "redirect") redirect("/auth/sign-in");
    throw new Error("Aucune branche active");
  }

  if (!organizationId || !branchId) {
    if (onMissing === "redirect") redirect("/admin/organizations");
    throw new Error("Aucune branche active");
  }

  // Si customSession a déjà chargé la branche courante, éviter un findFirst.
  const sessionEducationSystem = (
    session.branch as { educationSystem?: string } | null | undefined
  )?.educationSystem;
  if (
    session.branch?.id === branchId &&
    session.branch.typebranch != null &&
    sessionEducationSystem
  ) {
    return {
      userId,
      organizationId,
      branchId,
      typebranch: session.branch.typebranch,
      educationSystem: sessionEducationSystem,
      session,
    };
  }

  const branch = await prisma.branch.findFirst({
    where: {
      id: branchId,
      organizationId,
    },
    select: {
      id: true,
      typebranch: true,
      educationSystem: true,
    },
  });

  if (!branch) {
    if (onMissing === "redirect") redirect("/admin/organizations");
    throw new Error("Branche introuvable dans cette organisation");
  }

  return {
    userId,
    organizationId,
    branchId,
    typebranch: branch.typebranch,
    educationSystem: branch.educationSystem,
    session,
  };
}

/** Branche active + droit finance (frais / paiement / caisse). */
export async function requireFinanceBranchContext() {
  const ctx = await requireBranchContext();
  if (!canAccessFinanceArea(ctx.session)) {
    throw new Error("Action non autorisée");
  }
  return ctx;
}

/** Branche active + droit CRUD personnel / parents (préfet exclu). */
export async function requireHrWriteBranchContext() {
  const ctx = await requireBranchContext();
  if (!canManageHrDirectory(ctx.session)) {
    throw new Error("Action non autorisée");
  }
  return ctx;
}
