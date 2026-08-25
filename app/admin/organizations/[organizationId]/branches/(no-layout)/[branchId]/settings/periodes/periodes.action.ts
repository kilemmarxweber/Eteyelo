"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "@/lib/zsa";
import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  canAccessSchoolOpsSettings,
  canPermanentlyDeleteInformation,
  PERMANENT_DELETE_DENIED_MESSAGE,
} from "@/lib/auth/session-roles";
import { ensureAcademicPeriodsForBranch } from "@/lib/academic-periods";
import {
  getAcademicStructure,
  normalizeBranchType,
} from "@/lib/academic-structure";
import { usesTermPeriodCalendar } from "@/lib/education-system";
import { cycleLabel } from "@/lib/cycle";

function assertCanManage(
  session: Awaited<ReturnType<typeof requireBranchContext>>["session"],
) {
  if (!canAccessSchoolOpsSettings(session)) {
    throw new Error("Vous n'avez pas la permission de gérer les périodes.");
  }
}

function structureBadgeLabel(
  typebranch: unknown,
  educationSystem?: unknown,
  cycles?: unknown[],
) {
  if (cycles && cycles.length > 1) {
    return cycles.map((cycle) => cycleLabel(cycle)).join(" + ");
  }
  const type = normalizeBranchType(typebranch);
  if (usesTermPeriodCalendar(type, educationSystem)) {
    return type === "PRIMAIRE"
      ? "Primaire — 3 trimestres / 3 périodes"
      : "Secondaire — 3 trimestres / 3 périodes";
  }
  switch (type) {
    case "PRIMAIRE":
      return "Primaire — trimestres";
    case "UNIVERSITE":
      return "Université — semestres LMD";
    case "ATELIER":
      return "Atelier";
    case "CENTRE_FORMATION":
      return "Centre de formation";
    default:
      return "Secondaire — semestres";
  }
}

function parseDateInput(value: string, fieldLabel: string) {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`${fieldLabel} invalide.`);
  }
  const date = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldLabel} invalide.`);
  }
  return date;
}

function toDateInputValue(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const periodInputSchema = z.object({
  id: z.number().int().positive().optional(),
  label: z
    .string()
    .trim()
    .min(2, "Le libellé doit contenir au moins 2 caractères.")
    .max(120),
  semesterId: z.coerce.number().int().positive("Choisissez un semestre."),
  startDate: z.string().min(1, "Date de début requise."),
  endDate: z.string().min(1, "Date de fin requise."),
});

function revalidatePeriodsPath(
  organizationId: string,
  branchId: string,
) {
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/settings/periodes`,
  );
}

export const listPeriodsSettingsAction = action.handler(async () => {
  const { branchId, typebranch, educationSystem, session, cycles } =
    await requireBranchContext();
  const canHardDelete = canPermanentlyDeleteInformation(session);
  const structure = getAcademicStructure(typebranch, educationSystem);

  const [semesters, periods] = await Promise.all([
    prisma.semester.findMany({
      where: { branchId },
      orderBy: [{ startDate: "asc" }, { label: "asc" }],
      select: {
        id: true,
        label: true,
        startDate: true,
        endDate: true,
        cycle: true,
      },
    }),
    prisma.period.findMany({
      where: { branchId },
      orderBy: [{ startDate: "asc" }, { label: "asc" }],
      select: {
        id: true,
        label: true,
        startDate: true,
        endDate: true,
        semesterId: true,
        gradesGenerated: true,
        cycle: true,
        semester: { select: { label: true, cycle: true } },
        _count: {
          select: {
            fiche: true,
            grades: true,
          },
        },
      },
    }),
  ]);

  return {
    typebranch: normalizeBranchType(typebranch),
    cycles,
    structureLabel: structureBadgeLabel(typebranch, educationSystem, cycles),
    groupLabels: structure.groups.map((group) => group.label),
    semesters: semesters.map((semester) => ({
      id: semester.id,
      label: semester.label,
      cycle: semester.cycle,
      startDate: toDateInputValue(semester.startDate),
      endDate: toDateInputValue(semester.endDate),
    })),
    periods: periods.map((period) => ({
      id: period.id,
      label: period.label,
      startDate: toDateInputValue(period.startDate),
      endDate: toDateInputValue(period.endDate),
      semesterId: period.semesterId,
      semesterLabel: period.semester?.label ?? "—",
      cycle: period.cycle ?? period.semester?.cycle ?? null,
      gradesGenerated: period.gradesGenerated,
      canDelete:
        canHardDelete &&
        period._count.fiche === 0 &&
        period._count.grades === 0,
    })),
  };
});

export const createPeriodSettingsAction = action
  .input(periodInputSchema.omit({ id: true }))
  .handler(async ({ input }) => {
    const context = await requireBranchContext();
    assertCanManage(context.session);

    const startDate = parseDateInput(input.startDate, "Date de début");
    const endDate = parseDateInput(input.endDate, "Date de fin");
    if (endDate.getTime() < startDate.getTime()) {
      throw new Error("La date de fin doit être après la date de début.");
    }

    const semester = await prisma.semester.findFirst({
      where: { id: input.semesterId, branchId: context.branchId },
      select: { id: true, cycle: true },
    });
    if (!semester) {
      throw new Error("Semestre / trimestre introuvable dans cette branche.");
    }

    const duplicate = await prisma.period.findFirst({
      where: {
        branchId: context.branchId,
        semesterId: input.semesterId,
        label: { equals: input.label, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new Error("Une période avec ce libellé existe déjà pour ce groupe.");
    }

    await prisma.period.create({
      data: {
        label: input.label,
        startDate,
        endDate,
        semesterId: input.semesterId,
        branchId: context.branchId,
        cycle: semester.cycle,
      },
    });

    revalidatePeriodsPath(context.organizationId, context.branchId);
    return { ok: true as const };
  });

export const updatePeriodSettingsAction = action
  .input(periodInputSchema.extend({ id: z.number().int().positive() }))
  .handler(async ({ input }) => {
    const context = await requireBranchContext();
    assertCanManage(context.session);

    const startDate = parseDateInput(input.startDate, "Date de début");
    const endDate = parseDateInput(input.endDate, "Date de fin");
    if (endDate.getTime() < startDate.getTime()) {
      throw new Error("La date de fin doit être après la date de début.");
    }

    const existing = await prisma.period.findFirst({
      where: { id: input.id, branchId: context.branchId },
      select: { id: true },
    });
    if (!existing) {
      throw new Error("Période introuvable dans cette branche.");
    }

    const semester = await prisma.semester.findFirst({
      where: { id: input.semesterId, branchId: context.branchId },
      select: { id: true },
    });
    if (!semester) {
      throw new Error("Semestre / trimestre introuvable dans cette branche.");
    }

    const duplicate = await prisma.period.findFirst({
      where: {
        branchId: context.branchId,
        semesterId: input.semesterId,
        label: { equals: input.label, mode: "insensitive" },
        id: { not: input.id },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new Error("Une période avec ce libellé existe déjà pour ce groupe.");
    }

    await prisma.period.update({
      where: { id: input.id },
      data: {
        label: input.label,
        startDate,
        endDate,
        semesterId: input.semesterId,
      },
    });

    revalidatePeriodsPath(context.organizationId, context.branchId);
    return { ok: true as const };
  });

export const deletePeriodSettingsAction = action
  .input(z.object({ id: z.number().int().positive() }))
  .handler(async ({ input }) => {
    const context = await requireBranchContext();
    assertCanManage(context.session);
    if (!canPermanentlyDeleteInformation(context.session)) {
      throw new Error(PERMANENT_DELETE_DENIED_MESSAGE);
    }

    const existing = await prisma.period.findFirst({
      where: { id: input.id, branchId: context.branchId },
      select: {
        id: true,
        _count: { select: { fiche: true, grades: true } },
      },
    });
    if (!existing) {
      throw new Error("Période introuvable dans cette branche.");
    }
    if (existing._count.fiche > 0 || existing._count.grades > 0) {
      throw new Error(
        "Impossible de supprimer : des fiches ou des notes sont liées à cette période.",
      );
    }

    await prisma.period.delete({ where: { id: existing.id } });
    revalidatePeriodsPath(context.organizationId, context.branchId);
    return { ok: true as const };
  });

export const ensurePeriodsFromTemplateAction = action.handler(async () => {
  const context = await requireBranchContext();
  assertCanManage(context.session);

  await ensureAcademicPeriodsForBranch({
    branchId: context.branchId,
    typebranch: context.typebranch,
    educationSystem: context.educationSystem,
    cycles: context.cycles,
  });

  revalidatePeriodsPath(context.organizationId, context.branchId);
  return { ok: true as const };
});
