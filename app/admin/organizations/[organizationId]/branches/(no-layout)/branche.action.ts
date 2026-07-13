"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createBranchFormSchema, type CreateBranchFormValues } from "./schema";
import { auth } from "@/lib/auth";
import { canManageOrganization } from "@/lib/auth/session-roles";
import { headers } from "next/headers";
import { ensureAcademicPeriodsForBranch } from "@/lib/academic-periods";
import { getAcademicYearForDate } from "@/lib/academic-year";
import {
  ensureUniqueIdentifier,
  generateCode,
} from "@/lib/generated-identifiers";
import { ensurePrimaryAcademicStructure } from "@/lib/primary-academic-structure";
import { ensureDefaultCreneaux } from "@/lib/default-creneaux";

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
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return { data: null, error: "Session introuvable." };
  }

  if (!canManageOrganization(session)) {
    return { data: null, error: "Action non autorisee." };
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

  const code = await ensureUniqueIdentifier({
    base: generateCode(parsed.data.name, "BR", 16),
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
        ville: parsed.data.ville?.trim() || null,
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

export async function switchBranchAction(branchId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.session?.id) {
    throw new Error("Session introuvable");
  }

  const organizationId =
    session?.organization?.id ?? session?.session?.activeOrganizationId;

  if (!organizationId) {
    throw new Error("Organisation active introuvable");
  }

  const branch = await prisma.branch.findFirst({
    where: {
      id: branchId,
      organizationId,
    },
  });

  if (!branch) {
    throw new Error("Branche introuvable dans cette organisation");
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
      typebranch: true,
      organizationId: true,
    },
  });
}

export async function updateBranchAction(
  branchId: string,
  values: CreateBranchFormValues,
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return { data: null, error: "Session introuvable." };
  }

  if (!canManageOrganization(session)) {
    return { data: null, error: "Action non autorisee." };
  }

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

  const activeOrganizationId =
    session?.organization?.id ?? session?.session?.activeOrganizationId;

  if (
    activeOrganizationId &&
    existingBranch.organizationId !== activeOrganizationId
  ) {
    return { data: null, error: "Action non autorisee." };
  }

  const code = await ensureUniqueIdentifier({
    base: generateCode(parsed.data.name, "BR", 16),
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
      ville: parsed.data.ville?.trim() || null,
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
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.id || !canManageOrganization(session)) {
    return { data: null, error: "Action non autorisee." };
  }

  const organizationId =
    session.organization?.id ?? session.session?.activeOrganizationId;
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, ...(organizationId ? { organizationId } : {}) },
    select: { id: true, organizationId: true },
  });

  if (!branch) {
    return { data: null, error: "Etablissement introuvable." };
  }

  await prisma.branch.update({
    where: { id: branchId },
    data: { isActive },
  });

  revalidatePath(`/admin/organizations/${branch.organizationId}/branches`);
  revalidatePath("/");

  return { data: { id: branchId, isActive }, error: null };
}
