import { redirect } from "next/navigation";

import { getCachedSession } from "@/lib/auth/get-session-cached";
import {
  canAccessFinanceArea,
  canAccessFinanceOversight,
  canManageHrDirectory,
} from "@/lib/auth/session-roles";
import { prisma } from "@/lib/prisma";

import { getBranchCycles } from "@/lib/cycle";

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
    redirect("/auth/sign-in");
  }

  if (!organizationId || !branchId) {
    if (onMissing === "redirect") redirect("/admin/organizations");
    throw new Error("Aucune branche active");
  }

  // Si customSession a déjà chargé la branche courante, éviter un findFirst.
  const sessionEducationSystem = (
    session.branch as { educationSystem?: string } | null | undefined
  )?.educationSystem;
  const sessionCycles = (
    session.branch as { cycles?: Array<{ cycle: string; isActive?: boolean; sortOrder?: number }> } | null | undefined
  )?.cycles;

  const loadCycles = async (branchId: string, typebranch: unknown) => {
    if (sessionCycles && session.branch?.id === branchId) {
      return getBranchCycles({ typebranch, cycles: sessionCycles });
    }
    const rows = await prisma.branchCycle.findMany({
      where: { branchId, isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    return getBranchCycles({ typebranch, cycles: rows });
  };

  if (
    session.branch?.id === branchId &&
    session.branch.typebranch != null &&
    sessionEducationSystem
  ) {
    const cycles = await loadCycles(branchId, session.branch.typebranch);
    return {
      userId,
      organizationId,
      branchId,
      typebranch: session.branch.typebranch,
      educationSystem: sessionEducationSystem,
      cycles,
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
      cycles: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
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
    cycles: getBranchCycles(branch),
    session,
  };
}

/** Branche active + droit finance (paiement / caisse). */
export async function requireFinanceBranchContext() {
  const ctx = await requireBranchContext();
  if (!canAccessFinanceArea(ctx.session)) {
    throw new Error("Action non autorisée");
  }
  return ctx;
}

/** Catalogue des frais + situation impayés — sans caissier. */
export async function requireFinanceOversightBranchContext() {
  const ctx = await requireFinanceBranchContext();
  if (!canAccessFinanceOversight(ctx.session)) {
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
