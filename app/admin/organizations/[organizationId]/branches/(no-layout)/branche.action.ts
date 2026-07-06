"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createBranchFormSchema, type CreateBranchFormValues } from "./schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
export async function getBranchNameAction(branchId: string) {
  if (!branchId) return null;

  const branch = await prisma.branch.findFirst({
    where: { id: branchId },
    select: { name: true, image: true },
  });

  return branch;
}

export async function createBranchAction(
  organizationId: string,
  values: CreateBranchFormValues,
) {
  const parsed = createBranchFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      data: null,
      error: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });

  if (!organization) {
    return {
      data: null,
      error: "Organisation introuvable.",
    };
  }

  const branch = await prisma.branch.create({
    data: {
      organizationId,
      name: parsed.data.name,
      code: parsed.data.code?.trim() || null,
      adresse: parsed.data.adresse?.trim() || null,
      tel: parsed.data.tel?.trim() || null,
      ville: parsed.data.ville?.trim() || null,
      pays: parsed.data.pays?.trim() || null,
      idnat: parsed.data.idnat?.trim() || null,
      image: parsed.data.image ?? [],
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      attendanceRadius: parsed.data.attendanceRadius,
    },
    select: { id: true },
  });

  revalidatePath(`/admin/organizations/${organizationId}/branches`);

  return {
    data: branch,
    error: null,
  };
}

export async function switchBranchAction(branchId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.session?.id) {
    throw new Error("Session introuvable");
  }

  // Vérifie que la branche existe
  const branch = await prisma.branch.findUnique({
    where: {
      id: branchId,
    },
  });

  if (!branch) {
    throw new Error("Branche introuvable");
  }

  await prisma.session.update({
    where: {
      id: session.session.id,
    },
    data: {
      activeBranchId: branchId,
    },
  });

  return {
    success: true,
  };
}
export async function getBranchByIdAction(branchId: string) {
  if (!branchId) return null;

  return prisma.branch.findUnique({
    where: { id: branchId },
    select: {
      id: true,
      name: true,
      code: true,
      adresse: true,
      tel: true,
      ville: true,
      pays: true,
      idnat: true,
      image: true,
      latitude: true,
      longitude: true,
      attendanceRadius: true,
      organizationId: true,
    },
  });
}

export async function updateBranchAction(
  branchId: string,
  values: CreateBranchFormValues,
) {
  const parsed = createBranchFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      data: null,
      error: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }

  const existingBranch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, organizationId: true },
  });

  if (!existingBranch) {
    return {
      data: null,
      error: "Établissement introuvable.",
    };
  }

  const branch = await prisma.branch.update({
    where: { id: branchId },
    data: {
      name: parsed.data.name,
      code: parsed.data.code?.trim() || null,
      adresse: parsed.data.adresse?.trim() || null,
      tel: parsed.data.tel?.trim() || null,
      ville: parsed.data.ville?.trim() || null,
      pays: parsed.data.pays?.trim() || null,
      idnat: parsed.data.idnat?.trim() || null,
      image: JSON.stringify(parsed.data.image ?? []),
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      attendanceRadius: parsed.data.attendanceRadius,
    },
    select: { id: true },
  });

  revalidatePath(
    `/admin/organizations/${existingBranch.organizationId}/branches`,
  );
  revalidatePath(
    `/admin/organizations/${existingBranch.organizationId}/branches/${branchId}/edit`,
  );

  return {
    data: branch,
    error: null,
  };
}
