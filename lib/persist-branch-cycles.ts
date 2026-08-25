import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/prisma/generated/prisma/client";
import {
  CYCLE_SORT_ORDER,
  normalizeCycle,
} from "@/lib/cycle";

export async function persistActivatedBranchCycles(
  db: Prisma.TransactionClient | typeof prisma,
  branchId: string,
  cycles: unknown[],
) {
  const unique = [
    ...new Set(cycles.map((cycle) => normalizeCycle(cycle))),
  ].sort((a, b) => CYCLE_SORT_ORDER[a] - CYCLE_SORT_ORDER[b]);

  const toRemove = await db.branchCycle.findMany({
    where: {
      branchId,
      cycle: { notIn: unique },
    },
    select: { cycle: true },
  });
  if (toRemove.length > 0) {
    const used = await db.classe.count({
      where: {
        branchId,
        cycle: { in: toRemove.map((row) => row.cycle) },
      },
    });
    if (used > 0) {
      throw new Error(
        "Impossible de désactiver un cycle qui contient encore des classes.",
      );
    }
  }

  await db.branchCycle.deleteMany({
    where: {
      branchId,
      cycle: { notIn: unique },
    },
  });

  for (const [index, cycle] of unique.entries()) {
    await db.branchCycle.upsert({
      where: {
        branchId_cycle: { branchId, cycle },
      },
      update: { isActive: true, sortOrder: index },
      create: {
        branchId,
        cycle,
        sortOrder: index,
        isActive: true,
      },
    });
  }

  return unique;
}
