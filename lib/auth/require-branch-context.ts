import { redirect } from "next/navigation";

import {
  canAccessBranchAreaAsync,
  canMutateBranchAreaAsync,
  canWriteBranchAreaAsync,
  type BranchArea,
  type BranchAreaMutateAction,
} from "@/lib/auth/assert-branch-area-access";
import { getCachedSession } from "@/lib/auth/get-session-cached";
import { checkOrganizationPermission } from "@/lib/auth/has-organization-permission";
import { canAccessFinanceArea } from "@/lib/auth/session-roles";
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

type BranchContext = Awaited<ReturnType<typeof requireBranchContext>>;

async function assertBranchAreaOrThrow(area: BranchArea, ctx: BranchContext) {
  const allowed = await canAccessBranchAreaAsync(
    area,
    ctx.session,
    ctx.organizationId,
    ctx.branchId,
  );
  if (!allowed) {
    throw new Error("Action non autorisée");
  }
}

/** Branche active + accès DAC / octroi temporaire à une zone. */
export async function requireBranchAreaContext(area: BranchArea) {
  const ctx = await requireBranchContext();
  await assertBranchAreaOrThrow(area, ctx);
  return ctx;
}

/**
 * Branche active + droit d'écriture (create / update / delete) :
 * rôle gestionnaire, DAC, ou octroi temporaire.
 */
export async function requireBranchAreaWriteContext(area: BranchArea) {
  const ctx = await requireBranchContext();
  const allowed = await canWriteBranchAreaAsync(
    area,
    ctx.session,
    ctx.organizationId,
    ctx.branchId,
  );
  if (!allowed) {
    throw new Error("Action non autorisée");
  }
  return ctx;
}

/**
 * Branche active + action d'écriture précise (create, update ou delete).
 * Un octroi `create` n'autorise pas `update` / `delete`.
 */
export async function requireBranchAreaActionContext(
  area: BranchArea,
  action: BranchAreaMutateAction,
) {
  const ctx = await requireBranchContext();
  const allowed = await canMutateBranchAreaAsync(
    area,
    action,
    ctx.session,
    ctx.organizationId,
    ctx.branchId,
  );
  if (!allowed) {
    throw new Error("Action non autorisée");
  }
  return ctx;
}

async function hasFinanceAction(
  ctx: BranchContext,
  action: "read" | "encaisser",
) {
  if (canAccessFinanceArea(ctx.session)) return true;
  const permission = await checkOrganizationPermission(
    ctx.organizationId,
    { finance: [action] },
    { branchId: ctx.branchId },
  );
  return permission.ok;
}

/** Branche active + droit finance (paiement / caisse), y compris octroi temporaire. */
export async function requireFinanceBranchContext() {
  return requireBranchAreaContext("finance");
}

/**
 * Encaissement / écriture caisse : rôle finance legacy, DAC `encaisser`,
 * ou octroi temporaire `finance:encaisser`.
 */
export async function requireFinanceCollectBranchContext() {
  const ctx = await requireFinanceBranchContext();
  if (await hasFinanceAction(ctx, "encaisser")) {
    return ctx;
  }
  throw new Error("Action non autorisée");
}

/**
 * Rapports / exports caisse qui exigent `finance:read`
 * (un octroi `encaisser` seul ne suffit pas).
 */
export async function requireFinanceReadBranchContext() {
  const ctx = await requireFinanceBranchContext();
  if (await hasFinanceAction(ctx, "read")) {
    return ctx;
  }
  throw new Error("Action non autorisée");
}

/** Catalogue des frais + situation impayés — DAC `fees:read` ou octroi. */
export async function requireFinanceOversightBranchContext() {
  return requireBranchAreaContext("fee_catalog");
}

/** Branche active + droit CRUD personnel / parents (préfet exclu). */
export async function requireHrWriteBranchContext() {
  return requireBranchAreaContext("hr_write");
}
