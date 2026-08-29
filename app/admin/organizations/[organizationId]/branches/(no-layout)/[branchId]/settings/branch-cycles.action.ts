"use server";

import { action } from "@/lib/zsa";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { loadBranchCycleContext } from "@/lib/auth/cycle-scope";
import { cycleLabel } from "@/lib/cycle";

export const getBranchCyclesForFormsAction = action.handler(async () => {
  const { branchId } = await requireBranchContext();
  const { cycles, isMultiCycle } = await loadBranchCycleContext(branchId);
  return {
    cycles: cycles.map((cycle) => ({
      value: cycle,
      label: cycleLabel(cycle),
    })),
    isMultiCycle,
  };
});
