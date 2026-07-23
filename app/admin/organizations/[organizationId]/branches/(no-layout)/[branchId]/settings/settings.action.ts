"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { canAccessBranchOrgSettings } from "@/lib/auth/session-roles";

const eventTypeSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(3, "Le nom doit contenir au moins 3 caractères.").max(80),
});

function assertCanManage(session: Awaited<ReturnType<typeof requireBranchContext>>["session"]) {
  if (!canAccessBranchOrgSettings(session)) throw new Error("Action non autorisée.");
}

export async function getCalendarSettingsAction() {
  const { branchId } = await requireBranchContext();
  return prisma.eventType.findMany({
    where: { branchId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { events: true } } },
  });
}

export async function getCalendarClassesAction() {
  const { branchId } = await requireBranchContext();
  return prisma.classe.findMany({
    where: {
      branchId,
      OR: [{ statusClasse: true }, { statusClasse: null }],
    },
    orderBy: [{ nameClasse: "asc" }, { codeClasse: "asc" }],
    select: {
      id: true,
      nameClasse: true,
      codeClasse: true,
    },
  });
}

export async function saveEventTypeAction(input: z.infer<typeof eventTypeSchema>) {
  const context = await requireBranchContext();
  assertCanManage(context.session);
  const data = eventTypeSchema.parse(input);
  const duplicate = await prisma.eventType.findFirst({
    where: { branchId: context.branchId, name: { equals: data.name, mode: "insensitive" }, ...(data.id ? { id: { not: data.id } } : {}) },
    select: { id: true },
  });
  if (duplicate) return { ok: false, message: "Ce type d'événement existe déjà." };

  if (data.id) {
    const existing = await prisma.eventType.findFirst({ where: { id: data.id, branchId: context.branchId }, select: { id: true } });
    if (!existing) return { ok: false, message: "Type d'événement introuvable." };
    await prisma.eventType.update({ where: { id: data.id }, data: { name: data.name } });
  } else {
    await prisma.eventType.create({ data: { branchId: context.branchId, name: data.name } });
  }
  revalidatePath(`/admin/organizations/${context.organizationId}/branches/${context.branchId}/settings/calendar`);
  return { ok: true, message: data.id ? "Type d'événement modifié." : "Type d'événement créé." };
}

const attendanceSettingsSchema = z.object({ attendanceRadius: z.coerce.number().int().min(10).max(5000) });

export async function getAttendanceSettingsAction() {
  const { branchId } = await requireBranchContext();
  return prisma.branch.findUniqueOrThrow({ where: { id: branchId }, select: { attendanceRadius: true, latitude: true, longitude: true } });
}

export async function saveAttendanceSettingsAction(input: { attendanceRadius: number }) {
  const context = await requireBranchContext();
  assertCanManage(context.session);
  const data = attendanceSettingsSchema.parse(input);
  await prisma.branch.update({ where: { id: context.branchId }, data });
  revalidatePath(`/admin/organizations/${context.organizationId}/branches/${context.branchId}/settings/attendance`);
  return { ok: true, message: "Paramètres de présence enregistrés." };
}

const primaryDomainSchema = z.enum([
  "LANGUES",
  "MATH_SCIENCES_TECH",
  "UNIVERS_SOCIAUX",
  "ARTS",
  "DEVELOPPEMENT",
]);

const primaryCourseDomainUpdateSchema = z.object({
  coursId: z.string().min(1),
  primaryDomain: primaryDomainSchema.nullable(),
  primarySection: z.string().trim().max(120).nullable(),
  domainOrder: z.coerce.number().int().min(0).max(9999).nullable(),
});

export async function getPrimaryDomainsSettingsAction() {
  const { branchId, typebranch } = await requireBranchContext();
  const courses = await prisma.cours.findMany({
    where: {
      branchId,
      // Inclure true et null (comme la liste Cours) — `{ not: false }` exclut les NULL en SQL
      OR: [{ statusCours: true }, { statusCours: null }],
    },
    orderBy: [{ domainOrder: "asc" }, { nameCours: "asc" }],
    select: {
      id: true,
      nameCours: true,
      codeCours: true,
      primaryDomain: true,
      primarySection: true,
      domainOrder: true,
    },
  });
  return {
    isPrimary: typebranch === "PRIMAIRE",
    courses: courses.map((course) => ({
      id: course.id,
      nameCours: course.nameCours,
      codeCours: course.codeCours,
      primaryDomain: course.primaryDomain,
      primarySection: course.primarySection,
      domainOrder: course.domainOrder,
    })),
  };
}

/** Affecte automatiquement les domaines catalogue aux cours sans domaine (primaire). */
export async function ensurePrimaryDomainsAction() {
  const context = await requireBranchContext();
  assertCanManage(context.session);
  if (context.typebranch !== "PRIMAIRE") {
    return { ok: false, message: "Disponible uniquement pour une branche primaire.", updated: 0 };
  }

  const { getCatalogPrimaryPlacement } = await import("@/lib/primary-domains");
  const courses = await prisma.cours.findMany({
    where: { branchId: context.branchId },
    select: { id: true, nameCours: true, primaryDomain: true },
  });

  let updated = 0;
  for (const course of courses) {
    if (course.primaryDomain) continue;
    const placement = getCatalogPrimaryPlacement(course.nameCours);
    await prisma.cours.update({
      where: { id: course.id },
      data: {
        primaryDomain: placement.domain,
        primarySection:
          placement.section === "AUTRES" || placement.section === "AUTRES COURS"
            ? null
            : placement.section,
        domainOrder: placement.sortOrder,
      },
    });
    updated += 1;
  }

  revalidatePath(
    `/admin/organizations/${context.organizationId}/branches/${context.branchId}/settings/primary-domains`,
  );
  revalidatePath(
    `/admin/organizations/${context.organizationId}/branches/${context.branchId}/cours`,
  );
  return {
    ok: true,
    message:
      updated > 0
        ? `${updated} cours classé(s) automatiquement.`
        : "Tous les cours ont déjà un domaine.",
    updated,
  };
}

/** Crée / met à jour tous les cours du catalogue officiel RDC (5 domaines) pour la branche. */
export async function importPrimaryCatalogCoursesAction() {
  const context = await requireBranchContext();
  assertCanManage(context.session);
  if (context.typebranch !== "PRIMAIRE") {
    return {
      ok: false,
      message: "Disponible uniquement pour une branche primaire.",
      created: 0,
      updated: 0,
    };
  }

  const { upsertPrimaryCatalogCoursesForBranch } = await import(
    "@/lib/primary-catalog-sync"
  );
  const result = await upsertPrimaryCatalogCoursesForBranch(context.branchId);

  revalidatePath(
    `/admin/organizations/${context.organizationId}/branches/${context.branchId}/settings/primary-domains`,
  );
  revalidatePath(
    `/admin/organizations/${context.organizationId}/branches/${context.branchId}/cours`,
  );

  return {
    ok: true,
    message: `Catalogue RDC importé : ${result.created} créé(s), ${result.updated} mis à jour, ${result.skipped} déjà à jour.`,
    ...result,
  };
}

export async function savePrimaryCourseDomainAction(
  input: z.infer<typeof primaryCourseDomainUpdateSchema>,
) {
  const context = await requireBranchContext();
  assertCanManage(context.session);
  if (context.typebranch !== "PRIMAIRE") {
    return { ok: false, message: "Disponible uniquement pour une branche primaire." };
  }

  const data = primaryCourseDomainUpdateSchema.parse(input);
  const existing = await prisma.cours.findFirst({
    where: { id: data.coursId, branchId: context.branchId },
    select: { id: true },
  });
  if (!existing) return { ok: false, message: "Cours introuvable." };

  await prisma.cours.update({
    where: { id: data.coursId },
    data: {
      primaryDomain: data.primaryDomain,
      primarySection: data.primarySection?.trim() || null,
      domainOrder: data.domainOrder,
    },
  });

  revalidatePath(
    `/admin/organizations/${context.organizationId}/branches/${context.branchId}/settings/primary-domains`,
  );
  return { ok: true, message: "Domaine enregistré." };
}
