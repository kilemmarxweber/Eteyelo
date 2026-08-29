import { prisma } from "@/lib/prisma";
import {
  getBranchCycles,
  isCycle,
  isMultiCycleBranch,
  normalizeCycle,
  type Cycle,
} from "@/lib/cycle";
import {
  canViewAllDirectoryUsers,
  isCycleGlobalRole,
} from "@/lib/auth/cycle-global-roles";
import type {
  Cycle as PrismaCycle,
  Prisma,
} from "@/prisma/generated/prisma/client";
import { ORG_ROLE } from "@/lib/permissions";
import {
  getSessionRoles,
  hasSessionRole,
} from "@/lib/auth/session-roles";

export {
  CYCLE_GLOBAL_ROLES,
  USER_DIRECTORY_GLOBAL_ROLES,
  canViewAllDirectoryUsers,
  isCycleGlobalRole,
  type CycleGlobalRole,
  type UserDirectoryGlobalRole,
} from "@/lib/auth/cycle-global-roles";

export async function loadBranchCycleContext(branchId: string) {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: {
      id: true,
      typebranch: true,
      cycles: {
        where: { isActive: true },
        select: { cycle: true, sortOrder: true, isActive: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!branch) {
    throw new Error("Branche introuvable.");
  }
  const cycles = getBranchCycles(branch);
  return {
    branch,
    cycles,
    isMultiCycle: isMultiCycleBranch(branch),
  };
}

function toPrismaCycles(cycles: Cycle[]): PrismaCycle[] {
  return cycles.map((cycle) => cycle as PrismaCycle);
}

/**
 * Persiste les cycles d'un BranchMember.
 * - Propriétaire / gestionnaire → tous les cycles actifs.
 * - Caissier (transverse data) → tous les cycles (caisse unique).
 * - Sinon → cycles fournis (au moins 1 en multi-cycle).
 */
export async function assignBranchMemberCycles(params: {
  branchMemberId: string;
  branchId: string;
  orgRole?: string | null;
  cycles?: unknown[] | null;
}): Promise<Cycle[]> {
  const { cycles: branchCycles, isMultiCycle } = await loadBranchCycleContext(
    params.branchId,
  );

  let next: Cycle[];

  // Propriétaire / gestionnaire : tous les cycles (annuaire + ACL).
  if (canViewAllDirectoryUsers(params.orgRole)) {
    next = branchCycles;
  } else if (params.cycles && params.cycles.length > 0) {
    next = [
      ...new Set(
        params.cycles
          .filter((value) => value != null && value !== "")
          .map((value) => normalizeCycle(value)),
      ),
    ].filter((cycle) => branchCycles.includes(cycle));
  } else if (!isMultiCycle) {
    next = branchCycles;
  } else if (isCycleGlobalRole(params.orgRole)) {
    // Caissier : accès data tous cycles via isCycleGlobalRole, sans lignes
    // BranchMemberCycle (sinon l'annuaire le verrait comme « tous les users »).
    next = [];
  } else {
    throw new Error(
      "Choisissez au moins un cycle pour cet utilisateur (établissement multi-cycle).",
    );
  }

  if (next.length === 0 && !isCycleGlobalRole(params.orgRole)) {
    throw new Error("Aucun cycle valide pour cet établissement.");
  }

  await prisma.$transaction([
    prisma.branchMemberCycle.deleteMany({
      where: { branchMemberId: params.branchMemberId },
    }),
    ...(next.length
      ? [
          prisma.branchMemberCycle.createMany({
            data: next.map((cycle) => ({
              branchMemberId: params.branchMemberId,
              cycle: cycle as PrismaCycle,
            })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

  return next.length ? next : branchCycles;
}

export async function getBranchMemberCycles(
  branchMemberId: string,
): Promise<Cycle[]> {
  const rows = await prisma.branchMemberCycle.findMany({
    where: { branchMemberId },
    select: { cycle: true },
  });
  return rows.map((row) => normalizeCycle(row.cycle));
}

/**
 * Cycles visibles pour un membre dans une branche.
 * Rôle transverse / sans lignes → tous les cycles de la branche.
 */
export async function resolveAccessibleCycles(params: {
  branchId: string;
  branchMemberId?: string | null;
  orgRole?: string | null;
}): Promise<Cycle[]> {
  const { cycles: branchCycles } = await loadBranchCycleContext(params.branchId);

  if (isCycleGlobalRole(params.orgRole)) {
    return branchCycles;
  }

  if (!params.branchMemberId) {
    return branchCycles;
  }

  const assigned = await getBranchMemberCycles(params.branchMemberId);
  if (assigned.length === 0) {
    // Legacy : pas encore migrés → accès complet jusqu'à restriction.
    return branchCycles;
  }

  return assigned.filter((cycle) => branchCycles.includes(cycle));
}

/** Filtre Prisma pour les classes du périmètre cycle. */
export function classeCycleWhere(cycles: Cycle[]) {
  if (cycles.length === 0) return {};
  return {
    OR: [
      { cycle: { in: toPrismaCycles(cycles) } },
      // Legacy null : visible seulement si mono-cycle (appelant filtre déjà).
      ...(cycles.length === 1 ? [{ cycle: null }] : []),
    ],
  };
}

export function parseCyclesInput(value: unknown): Cycle[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((item) => isCycle(item) || typeof item === "string")
        .map((item) => normalizeCycle(item)),
    ),
  ];
}

export function sessionCanViewAllDirectoryUsers(
  session: unknown,
  memberRole?: string | null,
): boolean {
  if (canViewAllDirectoryUsers(memberRole)) return true;
  return hasSessionRole(
    session as Parameters<typeof hasSessionRole>[0],
    [
      ORG_ROLE.OWNER,
      ORG_ROLE.GESTIONNAIRE,
      ORG_ROLE.AGENT_BUREAU,
      "owner",
      "gestionnaire",
      "proprietaire",
      "agent_bureau",
      "membre_bureau",
    ],
    memberRole,
  );
}

/**
 * Filtre `BranchMember` pour l'annuaire :
 * - propriétaire / gestionnaire → pas de filtre (seeAll) ;
 * - caissier → toute la branche active (seeWholeBranch), sans cloison cycle ;
 * - autres → soi-même, leadership, ou membres partageant un cycle.
 */
export async function buildBranchMemberDirectoryWhere(params: {
  viewerBranchMemberId: string | null;
  seeAll: boolean;
  /** Ex. caissier : voit les users de sa branche, pas cloisonnés par cycle. */
  seeWholeBranch?: boolean;
}): Promise<Prisma.BranchMemberWhereInput | undefined> {
  if (params.seeAll || params.seeWholeBranch) return undefined;
  if (!params.viewerBranchMemberId) {
    return { id: "__none__" };
  }

  const cycles = await getBranchMemberCycles(params.viewerBranchMemberId);

  return {
    OR: [
      { id: params.viewerBranchMemberId },
      {
        member: {
          role: {
            in: [
              ORG_ROLE.OWNER,
              ORG_ROLE.GESTIONNAIRE,
              ORG_ROLE.AGENT_BUREAU,
              "owner",
              "gestionnaire",
              "agent_bureau",
              "membre_bureau",
            ],
          },
        },
      },
      cycles.length > 0
        ? {
            memberCycles: {
              some: { cycle: { in: toPrismaCycles(cycles) } },
            },
          }
        : { memberCycles: { none: {} } },
    ],
  };
}

export function primaryOrgRoleFromSession(
  session: unknown,
  memberRole?: string | null,
): string | null {
  if (memberRole) return memberRole;
  const roles = getSessionRoles(
    session as Parameters<typeof getSessionRoles>[0],
    memberRole,
  );
  for (const role of [
    ORG_ROLE.OWNER,
    ORG_ROLE.GESTIONNAIRE,
    ORG_ROLE.CAISSIER,
  ]) {
    if (roles.has(role)) return role;
  }
  return [...roles][0] ?? null;
}
