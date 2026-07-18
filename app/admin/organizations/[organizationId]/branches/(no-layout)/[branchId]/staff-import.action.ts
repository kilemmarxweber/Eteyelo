"use server";

import { revalidatePath } from "next/cache";

import {
  linkPersonnelToBranch,
  linkTeacherToBranch,
  searchOrganizationPersonnelsForBranchImport,
  searchOrganizationTeachersForBranchImport,
  supportsStaffImport,
} from "@/lib/extended-staff-import";
import { getPeopleLabels } from "@/lib/people-labels";
import { getCurrentBranch } from "./student/student.action";

function revalidateStaffPages(organizationId: string, branchId: string) {
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/teacher`,
  );
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/personnel`,
  );
}

export async function getStaffPageContextAction() {
  const ctx = await getCurrentBranch();

  return {
    supportsStaffImport: supportsStaffImport(ctx.typebranch),
    typebranch: ctx.typebranch,
    peopleLabels: getPeopleLabels(ctx.typebranch),
  };
}

export async function searchOrganizationTeachersForImport(params: {
  query?: string;
  limit?: number;
}) {
  const ctx = await getCurrentBranch();

  if (!ctx.canManageStudents) {
    return { ok: false as const, message: "Action non autorisee" };
  }

  if (!supportsStaffImport(ctx.typebranch)) {
    return {
      ok: false as const,
      message: "L'import n'est pas disponible pour ce type de branche",
    };
  }

  const teachers = await searchOrganizationTeachersForBranchImport({
    organizationId: ctx.organizationId,
    targetBranchId: ctx.branchId,
    query: params.query,
    limit: params.limit,
  });

  return { ok: true as const, staff: teachers };
}

export async function searchOrganizationPersonnelsForImport(params: {
  query?: string;
  limit?: number;
}) {
  const ctx = await getCurrentBranch();

  if (!ctx.canManageStudents) {
    return { ok: false as const, message: "Action non autorisee" };
  }

  if (!supportsStaffImport(ctx.typebranch)) {
    return {
      ok: false as const,
      message: "L'import n'est pas disponible pour ce type de branche",
    };
  }

  const staff = await searchOrganizationPersonnelsForBranchImport({
    organizationId: ctx.organizationId,
    targetBranchId: ctx.branchId,
    query: params.query,
    limit: params.limit,
  });

  return { ok: true as const, staff };
}

export async function linkTeacherToBranchAction(input: {
  teacherId: string;
  sourceBranchId: string;
}) {
  const ctx = await getCurrentBranch();

  if (!ctx.canManageStudents) {
    return { ok: false as const, message: "Action non autorisee" };
  }

  if (!supportsStaffImport(ctx.typebranch)) {
    return { ok: false as const, message: "Import non autorise pour cette branche" };
  }

  try {
    await linkTeacherToBranch({
      teacherId: input.teacherId,
      sourceBranchId: input.sourceBranchId,
      targetBranchId: ctx.branchId,
      organizationId: ctx.organizationId,
    });

    revalidateStaffPages(ctx.organizationId, ctx.branchId);
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Import impossible",
    };
  }
}

export async function linkPersonnelToBranchAction(input: {
  personnelId: string;
  sourceBranchId: string;
}) {
  const ctx = await getCurrentBranch();

  if (!ctx.canManageStudents) {
    return { ok: false as const, message: "Action non autorisee" };
  }

  if (!supportsStaffImport(ctx.typebranch)) {
    return { ok: false as const, message: "Import non autorise pour cette branche" };
  }

  try {
    await linkPersonnelToBranch({
      personnelId: input.personnelId,
      sourceBranchId: input.sourceBranchId,
      targetBranchId: ctx.branchId,
      organizationId: ctx.organizationId,
    });

    revalidateStaffPages(ctx.organizationId, ctx.branchId);
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Import impossible",
    };
  }
}
