"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createBranchFormSchema, type CreateBranchFormValues } from "./schema";
import {
  guardOrganizationManager,
} from "@/lib/auth/require-organization-permission";
import { switchActiveBranch } from "@/lib/auth/switch-branch";
import { ensureAcademicPeriodsForBranch } from "@/lib/academic-periods";
import { getAcademicYearForDate } from "@/lib/academic-year";
import {
  ensureUniqueIdentifier,
  generateCode,
} from "@/lib/generated-identifiers";
import { ensurePrimaryAcademicStructure } from "@/lib/primary-academic-structure";
import { ensureSecondaryCtebStructure } from "@/lib/secondary-cteb-structure";
import { ensureDefaultCreneaux } from "@/lib/default-creneaux";
import { ensureExtendedBranchStructure } from "@/lib/extended-branch-bootstrap";

export async function getBranchNameAction(branchId: string) {
  if (!branchId) return null;

  const branch = await prisma.branch.findFirst({
    where: { id: branchId },
    select: { name: true, image: true, typebranch: true },
  });

  return branch;
}

export async function createBranchAction(
  organizationId: string,
  values: CreateBranchFormValues,
) {
  const guard = await guardOrganizationManager(organizationId);
  if (!guard.ok) {
    return { data: null, error: guard.message };
  }

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

  const requestedCode = parsed.data.code?.trim().toUpperCase() || "";
  const code = await ensureUniqueIdentifier({
    base: requestedCode || generateCode(parsed.data.name, "BR", 16),
    separator: "",
    exists: async (value) =>
      Boolean(
        await prisma.branch.findFirst({
          where: { organizationId, code: value },
          select: { id: true },
        }),
      ),
  });

  const academicYear = getAcademicYearForDate();

  const branch = await prisma.$transaction(async (tx) => {
    const createdBranch = await tx.branch.create({
      data: {
        organizationId,
        name: parsed.data.name,
        code,
        adresse: parsed.data.adresse?.trim() || null,
        tel: parsed.data.tel?.trim() || null,
        province: parsed.data.province?.trim() || null,
        ville: parsed.data.ville?.trim() || null,
        commune: parsed.data.commune?.trim() || null,
        pays: parsed.data.pays?.trim() || null,
        idnat: parsed.data.idnat?.trim() || null,
        image: parsed.data.image ?? {
          logo: "",
          event: [],
          gallery: [],
          ecole: [],
        },
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        attendanceRadius: parsed.data.attendanceRadius,
        typebranch: parsed.data.typebranch,
      },
      select: { id: true },
    });

    await tx.schoolYear.create({
      data: {
        branchId: createdBranch.id,
        nameYear: academicYear.nameYear,
        startYear: academicYear.startYear,
        endYear: academicYear.endYear,
        isCurrentYear: true,
      },
    });

    if (parsed.data.typebranch === "PRIMAIRE") {
      await ensurePrimaryAcademicStructure(tx, createdBranch.id);
    }

    if (parsed.data.typebranch === "SECONDAIRE") {
      await ensureSecondaryCtebStructure(tx, createdBranch.id);
    }

    await ensureExtendedBranchStructure(
      tx,
      createdBranch.id,
      parsed.data.typebranch,
    );
    await ensureDefaultCreneaux(tx, createdBranch.id);

    return createdBranch;
  });

  await ensureAcademicPeriodsForBranch({
    branchId: branch.id,
    typebranch: parsed.data.typebranch,
  });

  revalidatePath(`/admin/organizations/${organizationId}/branches`);

  return {
    data: branch,
    error: null,
  };
}

export async function switchBranchAction(
  organizationId: string,
  branchId: string,
) {
  const result = await switchActiveBranch(organizationId, branchId);
  if (!result.ok) {
    throw new Error(result.message);
  }

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
      province: true,
      ville: true,
      commune: true,
      pays: true,
      idnat: true,
      image: true,
      latitude: true,
      longitude: true,
      attendanceRadius: true,
      typebranch: true,
      organizationId: true,
    },
  });
}

export async function updateBranchAction(
  branchId: string,
  values: CreateBranchFormValues,
) {
  const existingBranch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, organizationId: true, code: true },
  });

  if (!existingBranch) {
    return {
      data: null,
      error: "Établissement introuvable.",
    };
  }

  const guard = await guardOrganizationManager(existingBranch.organizationId);
  if (!guard.ok) {
    return { data: null, error: guard.message };
  }

  const parsed = createBranchFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      data: null,
      error: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }

  const requestedCode = parsed.data.code?.trim().toUpperCase() || "";
  const codeBase =
    requestedCode || existingBranch.code || generateCode(parsed.data.name, "BR", 16);
  const code = await ensureUniqueIdentifier({
    base: codeBase,
    separator: "",
    exists: async (value) =>
      Boolean(
        await prisma.branch.findFirst({
          where: {
            organizationId: existingBranch.organizationId,
            code: value,
            id: { not: branchId },
          },
          select: { id: true },
        }),
      ),
  });

  const branch = await prisma.branch.update({
    where: { id: branchId },
    data: {
      name: parsed.data.name,
      code,
      adresse: parsed.data.adresse?.trim() || null,
      tel: parsed.data.tel?.trim() || null,
      province: parsed.data.province?.trim() || null,
      ville: parsed.data.ville?.trim() || null,
      commune: parsed.data.commune?.trim() || null,
      pays: parsed.data.pays?.trim() || null,
      idnat: parsed.data.idnat?.trim() || null,
      image: parsed.data.image ?? {
        logo: "",
        event: [],
        gallery: [],
        ecole: [],
      },
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      attendanceRadius: parsed.data.attendanceRadius,
      typebranch: parsed.data.typebranch,
    },
    select: { id: true, typebranch: true },
  });

  await ensureAcademicPeriodsForBranch({
    branchId,
    typebranch: branch.typebranch,
  });
  if (branch.typebranch === "PRIMAIRE") {
    await ensurePrimaryAcademicStructure(prisma, branchId);
  }

  if (branch.typebranch === "SECONDAIRE") {
    await ensureSecondaryCtebStructure(prisma, branchId);
  }

  await ensureExtendedBranchStructure(prisma, branchId, branch.typebranch);

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

export async function setBranchActiveAction(
  branchId: string,
  isActive: boolean,
) {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId },
    select: { id: true, organizationId: true },
  });

  if (!branch) {
    return { data: null, error: "Etablissement introuvable." };
  }

  const guard = await guardOrganizationManager(branch.organizationId);
  if (!guard.ok) {
    return { data: null, error: guard.message };
  }

  await prisma.branch.update({
    where: { id: branchId },
    data: { isActive },
  });

  revalidatePath(`/admin/organizations/${branch.organizationId}/branches`);
  revalidatePath("/");

  return { data: { id: branchId, isActive }, error: null };
}
