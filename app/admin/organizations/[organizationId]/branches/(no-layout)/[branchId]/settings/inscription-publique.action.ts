"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/prisma/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { canAccessBranchOrgSettings } from "@/lib/auth/session-roles";
import { parseRentreeProgram } from "@/lib/registration-public-info";
import {
  branchRegistrationInfoFormSchema,
  toFeeCurrency,
  type BranchRegistrationInfoFormValues,
} from "@/app/admin/organizations/[organizationId]/inscription-publique/schema";

async function requireBranchRegistrationAccess() {
  const ctx = await requireBranchContext();
  if (!canAccessBranchOrgSettings(ctx.session)) {
    throw new Error("Action non autorisee.");
  }
  return ctx;
}

export async function getBranchRegistrationSettingsAction() {
  const { branchId, organizationId } = await requireBranchRegistrationAccess();

  const [schoolYears, info] = await Promise.all([
    prisma.schoolYear.findMany({
      where: { branchId, isArchived: false },
      orderBy: [{ isCurrentYear: "desc" }, { startYear: "desc" }],
      select: {
        id: true,
        nameYear: true,
        isCurrentYear: true,
      },
    }),
    prisma.branchRegistrationInfo.findFirst({
      where: { branchId },
      orderBy: [{ isPublished: "desc" }, { updatedAt: "desc" }],
    }),
  ]);

  const currentYear = schoolYears.find((year) => year.isCurrentYear);
  const preferred =
    (currentYear &&
      (await prisma.branchRegistrationInfo.findFirst({
        where: { branchId, schoolYearId: currentYear.id },
      }))) ||
    info;

  return {
    organizationId,
    branchId,
    schoolYears,
    initialValues: preferred
      ? ({
          id: preferred.id,
          branchId,
          schoolYearId: preferred.schoolYearId ?? currentYear?.id ?? "",
          isPublished: preferred.isPublished,
          termsTitle: preferred.termsTitle,
          termsContent: preferred.termsContent,
          registrationFeeRequired: preferred.registrationFeeRequired,
          registrationFeeAmount:
            preferred.registrationFeeAmount != null
              ? String(Number(preferred.registrationFeeAmount))
              : "",
          registrationFeeCurrency: toFeeCurrency(
            preferred.registrationFeeCurrency,
          ),
          registrationFeeLabel: preferred.registrationFeeLabel ?? "",
          registrationFeeDueNote: preferred.registrationFeeDueNote ?? "",
          rentreeProgram: parseRentreeProgram(preferred.rentreeProgram),
        } satisfies Partial<BranchRegistrationInfoFormValues>)
      : ({
          branchId,
          schoolYearId: currentYear?.id ?? "",
          isPublished: false,
          termsTitle: "Conditions d'inscription",
          termsContent: "",
          registrationFeeRequired: true,
          registrationFeeAmount: "",
          registrationFeeCurrency: "CDF",
          registrationFeeLabel: "Frais d'inscription",
          registrationFeeDueNote:
            "A regler aupres de la caisse avant la confirmation du dossier.",
          rentreeProgram: [],
        } satisfies Partial<BranchRegistrationInfoFormValues>),
  };
}

export async function saveBranchRegistrationSettingsAction(input: unknown) {
  const { branchId, organizationId } = await requireBranchRegistrationAccess();

  const parsed = branchRegistrationInfoFormSchema.safeParse({
    ...(typeof input === "object" && input ? input : {}),
    branchId,
  });

  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Donnees invalides.",
    };
  }

  const data = parsed.data;

  if (data.schoolYearId) {
    const year = await prisma.schoolYear.findFirst({
      where: { id: data.schoolYearId, branchId },
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
        where: { id: data.id, branchId },
        select: { id: true, publishedAt: true },
      });
      if (!existing) {
        return { ok: false as const, message: "Fiche introuvable." };
      }

      await prisma.branchRegistrationInfo.update({
        where: { id: data.id },
        data: {
          ...payload,
          branchId,
          schoolYearId,
          publishedAt: data.isPublished
            ? (existing.publishedAt ?? new Date())
            : null,
        },
      });
    } else {
      await prisma.branchRegistrationInfo.create({
        data: {
          ...payload,
          branchId,
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
    `/admin/organizations/${organizationId}/branches/${branchId}/settings/inscription-publique`,
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
