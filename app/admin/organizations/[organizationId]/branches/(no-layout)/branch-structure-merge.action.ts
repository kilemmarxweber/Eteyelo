"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { guardOrganizationManager } from "@/lib/auth/require-organization-permission";
import {
  isMergeSelectionEmpty,
  mergeBranchStructureToTargets,
  previewBranchStructureMerge,
  type BranchStructureMergeSelection,
} from "@/lib/branch-structure-merge";
import { prisma } from "@/lib/prisma";

const selectionSchema = z.object({
  sections: z.boolean(),
  options: z.boolean(),
  cours: z.boolean(),
  ponderations: z.boolean(),
  classes: z.boolean(),
});

const mergeInputSchema = z.object({
  organizationId: z.string().min(1),
  sourceBranchId: z.string().min(1),
  targetBranchIds: z.array(z.string().min(1)).min(1),
  selection: selectionSchema,
});

function errMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Une erreur est survenue.";
}

export async function listOrganizationBranchesForMergeAction(
  organizationId: string,
) {
  const guard = await guardOrganizationManager(organizationId);
  if (!guard.ok) {
    return { ok: false as const, message: guard.message };
  }

  const branches = await prisma.branch.findMany({
    where: { organizationId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      typebranch: true,
      isActive: true,
      _count: {
        select: {
          section: true,
          option: true,
          cours: true,
          coursPonderations: true,
          classes: true,
        },
      },
    },
  });

  return {
    ok: true as const,
    branches: branches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      typebranch: branch.typebranch,
      isActive: branch.isActive,
      counts: {
        sections: branch._count.section,
        options: branch._count.option,
        cours: branch._count.cours,
        ponderations: branch._count.coursPonderations,
        classes: branch._count.classes,
      },
    })),
  };
}

export async function previewBranchStructureMergeAction(input: {
  organizationId: string;
  sourceBranchId: string;
  targetBranchIds: string[];
}) {
  const parsed = mergeInputSchema
    .pick({ organizationId: true, sourceBranchId: true, targetBranchIds: true })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: "Données invalides." };
  }

  const guard = await guardOrganizationManager(parsed.data.organizationId);
  if (!guard.ok) {
    return { ok: false as const, message: guard.message };
  }

  try {
    const preview = await previewBranchStructureMerge(parsed.data);
    return { ok: true as const, preview };
  } catch (error) {
    return { ok: false as const, message: errMessage(error) };
  }
}

export async function mergeBranchStructureAction(input: {
  organizationId: string;
  sourceBranchId: string;
  targetBranchIds: string[];
  selection: BranchStructureMergeSelection;
}) {
  const parsed = mergeInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: "Données invalides." };
  }

  const guard = await guardOrganizationManager(parsed.data.organizationId);
  if (!guard.ok) {
    return { ok: false as const, message: guard.message };
  }

  if (isMergeSelectionEmpty(parsed.data.selection)) {
    return {
      ok: false as const,
      message: "Choisissez au moins un élément à copier.",
    };
  }

  try {
    const results = await mergeBranchStructureToTargets(parsed.data);
    const organizationId = parsed.data.organizationId;
    revalidatePath(`/admin/organizations/${organizationId}/branches`);
    for (const result of results) {
      const base = `/admin/organizations/${organizationId}/branches/${result.targetBranchId}`;
      revalidatePath(`${base}/section`);
      revalidatePath(`${base}/classe`);
      revalidatePath(`${base}/cours`);
      revalidatePath(`${base}/coursPonderationOption`);
      revalidatePath(`${base}/settings`);
    }
    return { ok: true as const, results };
  } catch (error) {
    return { ok: false as const, message: errMessage(error) };
  }
}
