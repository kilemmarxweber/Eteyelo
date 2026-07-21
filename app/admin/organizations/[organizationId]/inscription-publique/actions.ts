"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/prisma/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { guardOrganizationManager } from "@/lib/auth/require-organization-permission";
import { fetchPublishedBranchRegistrationInfo } from "@/lib/fetch-published-branch-registration-info";
import { branchRegistrationInfoFormSchema } from "./schema";

export async function getPublishedBranchRegistrationInfo(branchId: string) {
  return fetchPublishedBranchRegistrationInfo(branchId);
}

async function requireOrgManager(organizationId: string) {
  const guard = await guardOrganizationManager(organizationId);
  if (!guard.ok) {
    return { ok: false as const, message: guard.message };
  }
  return { ok: true as const, organizationId };
}

export async function listOrganizationRegistrationInfos(
  organizationId: string,
) {
  const access = await requireOrgManager(organizationId);
  if (!access.ok) {
    throw new Error(access.message);
  }

  return prisma.branchRegistrationInfo.findMany({
    where: { branch: { organizationId } },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      branch: { select: { id: true, name: true, ville: true } },
      schoolYear: {
        select: { id: true, nameYear: true, isCurrentYear: true },
      },
    },
  });
}

export async function getOrganizationBranchesForRegistration(
  organizationId: string,
) {
  const access = await requireOrgManager(organizationId);
  if (!access.ok) {
    throw new Error(access.message);
  }

  return prisma.branch.findMany({
    where: { organizationId, isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      ville: true,
      schoolYear: {
        where: { isArchived: false },
        orderBy: [{ isCurrentYear: "desc" }, { startYear: "desc" }],
        select: {
          id: true,
          nameYear: true,
          isCurrentYear: true,
        },
      },
    },
  });
}

export async function getRegistrationInfoForEdit(
  organizationId: string,
  infoId: string,
) {
  const access = await requireOrgManager(organizationId);
  if (!access.ok) {
    throw new Error(access.message);
  }

  return prisma.branchRegistrationInfo.findFirst({
    where: {
      id: infoId,
      branch: { organizationId },
    },
    include: {
      branch: { select: { id: true, name: true } },
      schoolYear: { select: { id: true, nameYear: true } },
    },
  });
}

export async function upsertBranchRegistrationInfoAction(input: unknown) {
  const parsed = branchRegistrationInfoFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Donnees invalides.",
    };
  }

  const data = parsed.data;

  const branch = await prisma.branch.findFirst({
    where: { id: data.branchId },
    select: { id: true, organizationId: true },
  });

  if (!branch) {
    return { ok: false as const, message: "Ecole introuvable." };
  }

  const access = await requireOrgManager(branch.organizationId);
  if (!access.ok) {
    return { ok: false as const, message: access.message };
  }

  if (data.schoolYearId) {
    const year = await prisma.schoolYear.findFirst({
      where: { id: data.schoolYearId, branchId: data.branchId },
      select: { id: true },
    });
    if (!year) {
      return {
        ok: false as const,
        message: "Annee scolaire invalide pour cette ecole.",
      };
    }
  }

  const schoolYearId = data.schoolYearId || null;
  const amount = data.registrationFeeAmount
    ? Number(data.registrationFeeAmount)
    : null;

  const payload = {
    termsTitle: data.termsTitle,
    termsContent: data.termsContent,
    isPublished: data.isPublished,
    registrationFeeRequired: data.registrationFeeRequired,
    registrationFeeAmount:
      amount == null || !Number.isFinite(amount)
        ? null
        : new Prisma.Decimal(amount),
    registrationFeeCurrency: data.registrationFeeCurrency || "CDF",
    registrationFeeLabel: data.registrationFeeLabel || null,
    registrationFeeDueNote: data.registrationFeeDueNote || null,
    rentreeProgram: data.rentreeProgram,
  };

  try {
    if (data.id) {
      const existing = await prisma.branchRegistrationInfo.findFirst({
        where: {
          id: data.id,
          branch: { organizationId: branch.organizationId },
        },
        select: { id: true, publishedAt: true },
      });
      if (!existing) {
        return { ok: false as const, message: "Fiche introuvable." };
      }

      await prisma.branchRegistrationInfo.update({
        where: { id: data.id },
        data: {
          ...payload,
          branchId: data.branchId,
          schoolYearId,
          publishedAt: data.isPublished
            ? existing.publishedAt ?? new Date()
            : null,
        },
      });
    } else {
      await prisma.branchRegistrationInfo.create({
        data: {
          ...payload,
          branchId: data.branchId,
          schoolYearId,
          publishedAt: data.isPublished ? new Date() : null,
        },
      });
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false as const,
        message:
          "Une fiche existe deja pour cette ecole et cette annee scolaire.",
      };
    }
    throw error;
  }

  revalidatePath(
    `/admin/organizations/${branch.organizationId}/inscription-publique`,
  );
  revalidatePath("/inscription");
  revalidatePath("/inscription-eleve");

  return {
    ok: true as const,
    message: data.isPublished
      ? "Infos d'inscription publiees."
      : "Infos d'inscription enregistrees (brouillon).",
  };
}

export async function deleteBranchRegistrationInfoAction(
  organizationId: string,
  infoId: string,
) {
  const access = await requireOrgManager(organizationId);
  if (!access.ok) {
    return { ok: false as const, message: access.message };
  }

  const existing = await prisma.branchRegistrationInfo.findFirst({
    where: {
      id: infoId,
      branch: { organizationId },
    },
    select: { id: true },
  });

  if (!existing) {
    return { ok: false as const, message: "Fiche introuvable." };
  }

  await prisma.branchRegistrationInfo.delete({ where: { id: infoId } });
  revalidatePath(`/admin/organizations/${organizationId}/inscription-publique`);
  revalidatePath("/inscription");
  revalidatePath("/inscription-eleve");

  return { ok: true as const, message: "Fiche supprimee." };
}
