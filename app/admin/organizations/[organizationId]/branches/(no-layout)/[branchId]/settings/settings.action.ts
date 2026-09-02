"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  canAccessBranchOrgSettings,
  canAccessSchoolStructureSettings,
} from "@/lib/auth/session-roles";
import {
  buildPrimaryDomainCode,
  getCatalogPrimaryPlacement,
} from "@/lib/primary-domains";
import {
  ensureBranchPrimaryDomains,
  listBranchPrimaryDomains,
} from "@/lib/branch-primary-domains";
import { activeCoursStatusFilter } from "@/lib/active-cours";

const eventTypeSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(3, "Le nom doit contenir au moins 3 caractères.").max(80),
});

function assertCanManage(session: Awaited<ReturnType<typeof requireBranchContext>>["session"]) {
  if (!canAccessBranchOrgSettings(session)) throw new Error("Action non autorisée.");
}

function assertCanManageSchoolOps(
  session: Awaited<ReturnType<typeof requireBranchContext>>["session"],
) {
  if (!canAccessSchoolStructureSettings(session)) {
    throw new Error("Action non autorisée.");
  }
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

const primaryDomainCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[A-Z][A-Z0-9_]*$/, "Code domaine invalide.");

const primaryCourseDomainUpdateSchema = z.object({
  coursId: z.string().min(1),
  primaryDomain: primaryDomainCodeSchema.nullable(),
  primarySection: z.string().trim().max(120).nullable(),
  domainOrder: z.coerce.number().int().min(0).max(9999).nullable(),
});

export async function getPrimaryDomainsSettingsAction() {
  const { branchId, typebranch } = await requireBranchContext();
  const [domains, courses] = await Promise.all([
    typebranch === "PRIMAIRE"
      ? listBranchPrimaryDomains(branchId)
      : Promise.resolve([]),
    prisma.cours.findMany({
      where: {
        branchId,
        ...activeCoursStatusFilter,
      },
      orderBy: [{ domainOrder: "asc" }, { nameCours: "asc" }],
      select: {
        id: true,
        nameCours: true,
        codeCours: true,
        description: true,
        primaryDomain: true,
        primarySection: true,
        domainOrder: true,
      },
    }),
  ]);
  return {
    isPrimary: typebranch === "PRIMAIRE",
    domains,
    courses: courses.map((course) => ({
      id: course.id,
      nameCours: course.nameCours,
      codeCours: course.codeCours,
      description: course.description ?? "",
      primaryDomain: course.primaryDomain,
      primarySection: course.primarySection,
      domainOrder: course.domainOrder,
    })),
  };
}

const branchDomainUpsertSchema = z.object({
  id: z.string().min(1).optional(),
  shortLabel: z
    .string()
    .trim()
    .min(2, "Le nom court doit avoir au moins 2 caractères.")
    .max(80),
  label: z
    .string()
    .trim()
    .min(3, "Le libellé bulletin doit avoir au moins 3 caractères.")
    .max(160),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

export async function saveBranchPrimaryDomainAction(
  input: z.infer<typeof branchDomainUpsertSchema>,
) {
  const context = await requireBranchContext();
  assertCanManageSchoolOps(context.session);
  if (context.typebranch !== "PRIMAIRE") {
    return { ok: false, message: "Disponible uniquement pour une branche primaire." };
  }

  const data = branchDomainUpsertSchema.parse(input);
  await ensureBranchPrimaryDomains(context.branchId);

  const shortLabel = data.shortLabel.trim();
  const label = data.label.trim();

  if (data.id) {
    const existing = await prisma.branchPrimaryDomain.findFirst({
      where: { id: data.id, branchId: context.branchId },
      select: { id: true, code: true },
    });
    if (!existing) return { ok: false, message: "Domaine introuvable." };

    const duplicateName = await prisma.branchPrimaryDomain.findFirst({
      where: {
        branchId: context.branchId,
        id: { not: data.id },
        OR: [
          { shortLabel: { equals: shortLabel, mode: "insensitive" } },
          { label: { equals: label, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (duplicateName) {
      return { ok: false, message: "Un domaine avec ce nom existe déjà." };
    }

    await prisma.branchPrimaryDomain.update({
      where: { id: data.id },
      data: {
        shortLabel,
        label,
        ...(data.sortOrder != null ? { sortOrder: data.sortOrder } : {}),
      },
    });

    revalidatePath(
      `/admin/organizations/${context.organizationId}/branches/${context.branchId}/settings/primary-domains`,
    );
    return { ok: true, message: "Domaine modifié." };
  }

  let code = buildPrimaryDomainCode(shortLabel);
  const codeTaken = await prisma.branchPrimaryDomain.findFirst({
    where: { branchId: context.branchId, code },
    select: { id: true },
  });
  if (codeTaken) {
    code = `${code}_${Date.now().toString(36).toUpperCase()}`.slice(0, 40);
  }

  const duplicateName = await prisma.branchPrimaryDomain.findFirst({
    where: {
      branchId: context.branchId,
      OR: [
        { shortLabel: { equals: shortLabel, mode: "insensitive" } },
        { label: { equals: label, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  if (duplicateName) {
    return { ok: false, message: "Un domaine avec ce nom existe déjà." };
  }

  const maxOrder = await prisma.branchPrimaryDomain.aggregate({
    where: { branchId: context.branchId },
    _max: { sortOrder: true },
  });

  await prisma.branchPrimaryDomain.create({
    data: {
      branchId: context.branchId,
      code,
      shortLabel,
      label,
      sortOrder: data.sortOrder ?? (maxOrder._max.sortOrder ?? 50) + 10,
      isSystem: false,
    },
  });

  revalidatePath(
    `/admin/organizations/${context.organizationId}/branches/${context.branchId}/settings/primary-domains`,
  );
  return { ok: true, message: "Domaine créé." };
}

export async function getBranchPrimaryDomainsAction() {
  const { branchId, typebranch } = await requireBranchContext();
  if (typebranch !== "PRIMAIRE") return [];
  return listBranchPrimaryDomains(branchId);
}

/** Affecte automatiquement les domaines catalogue aux cours sans domaine (primaire). */
export async function ensurePrimaryDomainsAction() {
  const context = await requireBranchContext();
  assertCanManageSchoolOps(context.session);
  if (context.typebranch !== "PRIMAIRE") {
    return { ok: false, message: "Disponible uniquement pour une branche primaire.", updated: 0 };
  }

  const { getCatalogPrimaryPlacement } = await import("@/lib/primary-domains");
  const courses = await prisma.cours.findMany({
    where: { branchId: context.branchId, ...activeCoursStatusFilter },
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

/** Crée / met à jour le catalogue primaire officiel (RDC ou 1.º ciclo angolais). */
export async function importPrimaryCatalogCoursesAction() {
  const context = await requireBranchContext();
  assertCanManageSchoolOps(context.session);
  if (context.typebranch !== "PRIMAIRE") {
    return {
      ok: false,
      message: "Disponible uniquement pour une branche primaire.",
      created: 0,
      updated: 0,
    };
  }

  const { normalizeEducationSystem } = await import("@/lib/education-system");
  const isAngola = normalizeEducationSystem(context.educationSystem) === "ANGOLAIS";

  const result = isAngola
    ? await (async () => {
        const { upsertAngolaPrimaryCoursesForBranch } = await import(
          "@/lib/angola-primary-catalog-sync"
        );
        const synced = await upsertAngolaPrimaryCoursesForBranch(context.branchId);
        return {
          created: synced.coursesCreated,
          updated: synced.coursesUpdated,
          skipped: synced.coursesSkipped,
          ponderationsCreated: synced.ponderationsCreated,
          ponderationsUpdated: synced.ponderationsUpdated,
          ponderationsSkipped: synced.ponderationsSkipped,
        };
      })()
    : await (async () => {
        const { upsertPrimaryCatalogCoursesForBranch } = await import(
          "@/lib/primary-catalog-sync"
        );
        return upsertPrimaryCatalogCoursesForBranch(context.branchId);
      })();

  revalidatePath(
    `/admin/organizations/${context.organizationId}/branches/${context.branchId}/settings/primary-domains`,
  );
  revalidatePath(
    `/admin/organizations/${context.organizationId}/branches/${context.branchId}/cours`,
  );
  revalidatePath(
    `/admin/organizations/${context.organizationId}/branches/${context.branchId}/coursPonderationOption`,
  );

  const catalogLabel = isAngola
    ? "Catalogue Ensino primário angolais (1ª–6ª)"
    : "Catalogue RDC";

  return {
    ok: true,
    message: `${catalogLabel} importé : ${result.created} cours créé(s), ${result.updated} mis à jour, ${result.skipped} déjà à jour. Pondérations : ${result.ponderationsCreated} créée(s), ${result.ponderationsUpdated} mise(s) à jour.`,
    ...result,
  };
}

export async function savePrimaryCourseDomainAction(
  input: z.infer<typeof primaryCourseDomainUpdateSchema>,
) {
  const context = await requireBranchContext();
  assertCanManageSchoolOps(context.session);
  if (context.typebranch !== "PRIMAIRE") {
    return { ok: false, message: "Disponible uniquement pour une branche primaire." };
  }

  const data = primaryCourseDomainUpdateSchema.parse(input);
  const existing = await prisma.cours.findFirst({
    where: {
      id: data.coursId,
      branchId: context.branchId,
      ...activeCoursStatusFilter,
    },
    select: { id: true },
  });
  if (!existing) {
    return {
      ok: false,
      message: "Cours introuvable ou désactivé.",
    };
  }

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

const primaryCourseUpsertSchema = z.object({
  id: z.string().min(1).optional(),
  nameCours: z
    .string()
    .trim()
    .min(4, "Le nom du cours doit avoir au moins 4 caractères."),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  primaryDomain: primaryDomainCodeSchema.nullable(),
});

function resolvePrimaryPlacement(
  courseName: string,
  selectedDomain: string | null,
) {
  if (!selectedDomain) {
    return {
      primaryDomain: null as string | null,
      primarySection: null as string | null,
      domainOrder: null as number | null,
    };
  }
  const catalog = getCatalogPrimaryPlacement(courseName);
  const useCatalog = catalog.domain === selectedDomain;
  return {
    primaryDomain: selectedDomain,
    primarySection: useCatalog
      ? catalog.section === "AUTRES" || catalog.section === "AUTRES COURS"
        ? null
        : catalog.section
      : null,
    domainOrder: useCatalog ? catalog.sortOrder : null,
  };
}

export async function createPrimaryCourseAction(
  input: z.infer<typeof primaryCourseUpsertSchema>,
) {
  const context = await requireBranchContext();
  assertCanManageSchoolOps(context.session);
  if (context.typebranch !== "PRIMAIRE") {
    return { ok: false, message: "Disponible uniquement pour une branche primaire." };
  }

  const data = primaryCourseUpsertSchema.parse(input);
  const nameCours = data.nameCours.trim();
  const duplicate = await prisma.cours.findFirst({
    where: {
      branchId: context.branchId,
      nameCours: { equals: nameCours, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (duplicate) {
    return { ok: false, message: "Un cours avec ce nom existe déjà." };
  }

  const { ensureUniqueIdentifier, generateCourseCode } = await import(
    "@/lib/generated-identifiers"
  );
  const codeCours = await ensureUniqueIdentifier({
    base: generateCourseCode(nameCours),
    separator: "",
    exists: async (value) =>
      Boolean(
        await prisma.cours.findFirst({
          where: { branchId: context.branchId, codeCours: value },
          select: { id: true },
        }),
      ),
  });

  const placement = resolvePrimaryPlacement(nameCours, data.primaryDomain);
  await prisma.cours.create({
    data: {
      nameCours,
      description: data.description?.trim() || null,
      codeCours,
      branchId: context.branchId,
      statusCours: true,
      ...placement,
    },
  });

  revalidatePath(
    `/admin/organizations/${context.organizationId}/branches/${context.branchId}/settings/primary-domains`,
  );
  revalidatePath(
    `/admin/organizations/${context.organizationId}/branches/${context.branchId}/cours`,
  );
  return { ok: true, message: "Cours créé." };
}

export async function updatePrimaryCourseAction(
  input: z.infer<typeof primaryCourseUpsertSchema>,
) {
  const context = await requireBranchContext();
  assertCanManageSchoolOps(context.session);
  if (context.typebranch !== "PRIMAIRE") {
    return { ok: false, message: "Disponible uniquement pour une branche primaire." };
  }

  const data = primaryCourseUpsertSchema.parse(input);
  if (!data.id) {
    return { ok: false, message: "Identifiant du cours manquant." };
  }

  const existing = await prisma.cours.findFirst({
    where: {
      id: data.id,
      branchId: context.branchId,
      ...activeCoursStatusFilter,
    },
    select: {
      id: true,
      primaryDomain: true,
      primarySection: true,
      domainOrder: true,
    },
  });
  if (!existing) {
    return { ok: false, message: "Cours introuvable ou désactivé." };
  }

  const nameCours = data.nameCours.trim();
  const duplicate = await prisma.cours.findFirst({
    where: {
      branchId: context.branchId,
      nameCours: { equals: nameCours, mode: "insensitive" },
      id: { not: data.id },
    },
    select: { id: true },
  });
  if (duplicate) {
    return { ok: false, message: "Un cours avec ce nom existe déjà." };
  }

  const placement = resolvePrimaryPlacement(nameCours, data.primaryDomain);
  const domainUnchanged = existing.primaryDomain === placement.primaryDomain;

  await prisma.cours.update({
    where: { id: data.id },
    data: {
      nameCours,
      description: data.description?.trim() || null,
      primaryDomain: placement.primaryDomain,
      primarySection: domainUnchanged
        ? existing.primarySection
        : placement.primarySection,
      domainOrder: domainUnchanged
        ? existing.domainOrder
        : placement.domainOrder,
    },
  });

  revalidatePath(
    `/admin/organizations/${context.organizationId}/branches/${context.branchId}/settings/primary-domains`,
  );
  revalidatePath(
    `/admin/organizations/${context.organizationId}/branches/${context.branchId}/cours`,
  );
  return { ok: true, message: "Cours mis à jour." };
}
