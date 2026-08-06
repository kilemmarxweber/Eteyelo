"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/prisma/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { canAccessSchoolOpsSettings } from "@/lib/auth/session-roles";
import { parseRentreeProgram } from "@/lib/registration-public-info";
import {
  branchRegistrationInfoFormSchema,
  toFeeCurrency,
  type BranchRegistrationInfoFormValues,
} from "@/app/admin/organizations/[organizationId]/inscription-publique/schema";

async function requireBranchRegistrationAccess() {
  const ctx = await requireBranchContext();
  if (!canAccessSchoolOpsSettings(ctx.session)) {
    throw new Error("Action non autorisee.");
  }
  return ctx;
}

function toFormValues(
  branchId: string,
  row: {
    id: string;
    schoolYearId: string | null;
    isPublished: boolean;
    termsTitle: string;
    termsContent: string;
    registrationFeeRequired: boolean;
    registrationFeeAmount: Prisma.Decimal | null;
    registrationFeeCurrency: string;
    registrationFeeLabel: string | null;
    registrationFeeDueNote: string | null;
    rentreeProgram: unknown;
  },
  fallbackSchoolYearId = "",
): BranchRegistrationInfoFormValues {
  return {
    id: row.id,
    branchId,
    schoolYearId: row.schoolYearId ?? fallbackSchoolYearId,
    isPublished: row.isPublished,
    termsTitle: row.termsTitle,
    termsContent: row.termsContent,
    registrationFeeRequired: row.registrationFeeRequired,
    registrationFeeAmount:
      row.registrationFeeAmount != null
        ? String(Number(row.registrationFeeAmount))
        : "",
    registrationFeeCurrency: toFeeCurrency(row.registrationFeeCurrency),
    registrationFeeLabel: row.registrationFeeLabel ?? "",
    registrationFeeDueNote: row.registrationFeeDueNote ?? "",
    rentreeProgram: parseRentreeProgram(row.rentreeProgram),
  };
}

export type BranchRegistrationInfoListItem = {
  id: string;
  schoolYearId: string | null;
  schoolYearName: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
  termsTitle: string;
  registrationFeeRequired: boolean;
  registrationFeeAmount: string | null;
  registrationFeeCurrency: string;
  rentreeCount: number;
  formValues: BranchRegistrationInfoFormValues;
};

export async function listBranchRegistrationInfosAction() {
  const { branchId, organizationId } = await requireBranchRegistrationAccess();

  const [schoolYears, infos] = await Promise.all([
    prisma.schoolYear.findMany({
      where: { branchId, isArchived: false },
      orderBy: [{ isCurrentYear: "desc" }, { startYear: "desc" }],
      select: {
        id: true,
        nameYear: true,
        isCurrentYear: true,
      },
    }),
    prisma.branchRegistrationInfo.findMany({
      where: { branchId },
      orderBy: [{ isPublished: "desc" }, { updatedAt: "desc" }],
      include: {
        schoolYear: {
          select: { id: true, nameYear: true, isCurrentYear: true },
        },
      },
    }),
  ]);

  const currentYear = schoolYears.find((year) => year.isCurrentYear);

  const items: BranchRegistrationInfoListItem[] = infos.map((row) => {
    const rentreeProgram = parseRentreeProgram(row.rentreeProgram);
    return {
      id: row.id,
      schoolYearId: row.schoolYearId,
      schoolYearName: row.schoolYear?.nameYear ?? null,
      isPublished: row.isPublished,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      termsTitle: row.termsTitle,
      registrationFeeRequired: row.registrationFeeRequired,
      registrationFeeAmount:
        row.registrationFeeAmount != null
          ? String(Number(row.registrationFeeAmount))
          : null,
      registrationFeeCurrency: row.registrationFeeCurrency,
      rentreeCount: rentreeProgram.length,
      formValues: toFormValues(branchId, row, currentYear?.id ?? ""),
    };
  });

  return {
    organizationId,
    branchId,
    schoolYears,
    currentSchoolYearId: currentYear?.id ?? "",
    items,
  };
}

/** @deprecated Prefer listBranchRegistrationInfosAction + form defaults. */
export async function getBranchRegistrationSettingsAction() {
  const data = await listBranchRegistrationInfosAction();
  const preferred =
    data.items.find(
      (item) =>
        item.schoolYearId && item.schoolYearId === data.currentSchoolYearId,
    ) ?? data.items[0];

  return {
    organizationId: data.organizationId,
    branchId: data.branchId,
    schoolYears: data.schoolYears,
    initialValues: preferred
      ? preferred.formValues
      : ({
          branchId: data.branchId,
          schoolYearId: data.currentSchoolYearId,
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

export async function deleteBranchRegistrationInfoAction(input: {
  id: string;
}) {
  const { branchId, organizationId } = await requireBranchRegistrationAccess();
  const id = typeof input?.id === "string" ? input.id.trim() : "";
  if (!id) {
    return { ok: false as const, message: "Fiche invalide." };
  }

  const existing = await prisma.branchRegistrationInfo.findFirst({
    where: { id, branchId },
    select: { id: true },
  });
  if (!existing) {
    return { ok: false as const, message: "Fiche introuvable." };
  }

  await prisma.branchRegistrationInfo.delete({ where: { id } });

  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/settings/inscription-publique`,
  );
  revalidatePath("/inscription");
  revalidatePath("/inscription-eleve");

  return { ok: true as const, message: "Fiche supprimee." };
}
