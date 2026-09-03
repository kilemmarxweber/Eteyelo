"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/prisma/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createBranchFormSchema,
  updateBranchFormSchema,
  type CreateBranchFormValues,
} from "./schema";
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
import { ensureMaternelleAcademicStructure } from "@/lib/maternelle-academic-structure";
import { ensureSecondaryCtebStructure } from "@/lib/secondary-cteb-structure";
import { ensureAngolaSecondaryStructure } from "@/lib/angola-secondary-bootstrap";
import { ensureAngolaPrimaryStructure } from "@/lib/angola-primary-bootstrap";
import { upsertAngolaSecondaryCoursesForBranch } from "@/lib/angola-secondary-catalog-sync";
import { upsertAngolaPrimaryCoursesForBranch } from "@/lib/angola-primary-catalog-sync";
import { ensureDefaultCreneaux } from "@/lib/default-creneaux";
import { ensureExtendedBranchStructure } from "@/lib/extended-branch-bootstrap";
import { persistActivatedBranchCycles } from "@/lib/persist-branch-cycles";
import { upsertClassCatalogForBranch } from "@/lib/class-catalog-sync";
import { purgeBranchCompletely } from "@/lib/purge-branch";
import { isRestrictedGestionnaire } from "@/lib/auth/role-labels";
import {
  isSchoolCycle,
  principalTypebranchFromSchoolCycles,
  resolveActivatedCycles,
  filterSchoolCyclesForEducationSystem,
  schoolCyclesForBranchForm,
  sameCycleSet,
  normalizeCycle,
  sortSchoolCycles,
} from "@/lib/cycle";
import { usesTermPeriodCalendar } from "@/lib/education-system";
import { isExtendedBranch } from "@/lib/branch-capabilities";

export async function getBranchNameAction(branchId: string) {
  if (!branchId) return null;

  const branch = await prisma.branch.findFirst({
    where: { id: branchId },
    select: { name: true, image: true, typebranch: true, cycles: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
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
  const schoolCycles = filterSchoolCyclesForEducationSystem(
    (parsed.data.schoolCycles ?? []).filter(isSchoolCycle),
    parsed.data.educationSystem,
  );
  const typebranch =
    schoolCycles.length > 0
      ? principalTypebranchFromSchoolCycles(schoolCycles)
      : parsed.data.typebranch;
  const activatedCycles = resolveActivatedCycles({
    typebranch,
    schoolCycles,
  });

  const branch = await prisma.$transaction(async (tx) => {
    const createdBranch = await tx.branch.create({
      data: {
        organizationId,
        name: parsed.data.name,
        description: parsed.data.description?.trim() || null,
        code,
        adresse: parsed.data.adresse?.trim() || null,
        note: parsed.data.note?.trim() || null,
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
        typebranch,
        educationSystem: usesTermPeriodCalendar(
          typebranch,
          parsed.data.educationSystem,
        )
          ? parsed.data.educationSystem
          : "CONGOLAIS",
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

    if (activatedCycles.includes("MATERNELLE")) {
      await ensureMaternelleAcademicStructure(tx, createdBranch.id);
    }
    if (activatedCycles.includes("PRIMAIRE")) {
      if (parsed.data.educationSystem === "ANGOLAIS") {
        await ensureAngolaPrimaryStructure(tx, createdBranch.id);
      } else {
        await ensurePrimaryAcademicStructure(tx, createdBranch.id);
      }
    }

    if (activatedCycles.includes("SECONDAIRE")) {
      if (parsed.data.educationSystem === "ANGOLAIS") {
        await ensureAngolaSecondaryStructure(tx, createdBranch.id);
      } else {
        await ensureSecondaryCtebStructure(tx, createdBranch.id);
      }
    }

    await ensureExtendedBranchStructure(tx, createdBranch.id, typebranch);
    await ensureDefaultCreneaux(
      tx,
      createdBranch.id,
      parsed.data.educationSystem,
    );
    await persistActivatedBranchCycles(tx, createdBranch.id, activatedCycles);

    return createdBranch;
  });

  await ensureAcademicPeriodsForBranch({
    branchId: branch.id,
    typebranch,
    educationSystem: parsed.data.educationSystem,
    cycles: activatedCycles,
  });

  if (activatedCycles.some(isSchoolCycle)) {
    await upsertClassCatalogForBranch(branch.id, {
      cycles: activatedCycles,
      importSectionsAndOptions: activatedCycles.includes("SECONDAIRE"),
    });
  }

  if (
    activatedCycles.includes("SECONDAIRE") &&
    parsed.data.educationSystem === "ANGOLAIS"
  ) {
    await upsertAngolaSecondaryCoursesForBranch(branch.id);
  }

  if (
    activatedCycles.includes("PRIMAIRE") &&
    parsed.data.educationSystem === "ANGOLAIS"
  ) {
    await upsertAngolaPrimaryCoursesForBranch(branch.id);
  }

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
      description: true,
      code: true,
      adresse: true,
      note: true,
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
      educationSystem: true,
      organizationId: true,
      cycles: {
        select: { cycle: true, isActive: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      },
      classes: {
        where: { cycle: { not: null } },
        distinct: ["cycle"],
        orderBy: { cycle: "asc" },
        select: { cycle: true },
      },
    },
  });
}

export async function updateBranchAction(
  branchId: string,
  values: CreateBranchFormValues,
) {
  const existingBranch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: {
      id: true,
      organizationId: true,
      code: true,
      educationSystem: true,
      typebranch: true,
      cycles: { select: { cycle: true, isActive: true, sortOrder: true } },
      classes: {
        where: { cycle: { not: null } },
        distinct: ["cycle"],
        orderBy: { cycle: "asc" },
        select: { cycle: true },
      },
    },
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

  const parsed = updateBranchFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      data: null,
      error: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }

  const existingSchoolCycles = schoolCyclesForBranchForm({
    typebranch: existingBranch.typebranch,
    branchCycles: existingBranch.cycles,
    classCycles: existingBranch.classes.map((row) => row.cycle),
  });
  const submittedSchoolCycles = (parsed.data.schoolCycles ?? []).filter(
    isSchoolCycle,
  );
  const extraCycles = existingBranch.cycles
    .map((row) => row.cycle)
    .filter((cycle) => !isSchoolCycle(cycle));
  const classSchoolCycles = existingBranch.classes
    .map((row) => row.cycle)
    .filter(isSchoolCycle);
  const schoolCycles = isExtendedBranch(parsed.data.typebranch)
    ? []
    : sortSchoolCycles(
        submittedSchoolCycles.length > 0
          ? [...submittedSchoolCycles, ...classSchoolCycles]
          : existingSchoolCycles,
      );
  const typebranch =
    schoolCycles.length > 0
      ? principalTypebranchFromSchoolCycles(schoolCycles)
      : parsed.data.typebranch;
  const activatedTarget = resolveActivatedCycles({
    typebranch,
    schoolCycles,
    extraCycles,
  });
  const existingCycleSet = existingBranch.cycles.map((row) =>
    normalizeCycle(row.cycle),
  );
  const cyclesUnchanged = sameCycleSet(existingCycleSet, activatedTarget);

  const nextEducationSystem = usesTermPeriodCalendar(
    typebranch,
    parsed.data.educationSystem,
  )
    ? parsed.data.educationSystem
    : "CONGOLAIS";

  if (existingBranch.educationSystem !== nextEducationSystem) {
    const gradeCount = await prisma.studentGrade.count({
      where: { branchId },
    });
    if (gradeCount > 0) {
      return {
        data: null,
        error:
          "Le système d'enseignement ne peut plus être modifié une fois des notes saisies.",
      };
    }
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

  const { branch, activatedCycles } = await prisma.$transaction(
    async (tx) => {
      const updated = await tx.branch.update({
        where: { id: branchId },
        data: {
          name: parsed.data.name,
          description: parsed.data.description?.trim() || null,
          code,
          adresse: parsed.data.adresse?.trim() || null,
          note: parsed.data.note?.trim() || null,
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
          typebranch,
          educationSystem: nextEducationSystem,
        },
        select: { id: true, typebranch: true, educationSystem: true },
      });

      if (cyclesUnchanged) {
        return {
          branch: updated,
          activatedCycles: activatedTarget,
        };
      }

      const persistedCycles = await persistActivatedBranchCycles(
        tx,
        branchId,
        activatedTarget,
      );
      return {
        branch: updated,
        activatedCycles: persistedCycles,
      };
    },
  );

  if (!cyclesUnchanged) {
    await ensureAcademicPeriodsForBranch({
      branchId,
      typebranch,
      educationSystem: branch.educationSystem,
      cycles: activatedCycles,
    });
    if (activatedCycles.some(isSchoolCycle)) {
      await upsertClassCatalogForBranch(branchId, {
        cycles: activatedCycles,
        importSectionsAndOptions: activatedCycles.includes("SECONDAIRE"),
      });
    }
    if (activatedCycles.includes("MATERNELLE")) {
      await ensureMaternelleAcademicStructure(prisma, branchId);
    }
    if (activatedCycles.includes("PRIMAIRE")) {
      if (branch.educationSystem === "ANGOLAIS") {
        await ensureAngolaPrimaryStructure(prisma, branchId);
        await upsertAngolaPrimaryCoursesForBranch(branchId);
      } else {
        await ensurePrimaryAcademicStructure(prisma, branchId);
      }
    }

    if (activatedCycles.includes("SECONDAIRE")) {
      if (branch.educationSystem === "ANGOLAIS") {
        await ensureAngolaSecondaryStructure(prisma, branchId);
        await upsertAngolaSecondaryCoursesForBranch(branchId);
      } else {
        await ensureSecondaryCtebStructure(prisma, branchId);
      }
    }

    await ensureExtendedBranchStructure(prisma, branchId, branch.typebranch);
  }

  revalidatePath(
    `/admin/organizations/${existingBranch.organizationId}/branches`,
  );
  revalidatePath(
    `/admin/organizations/${existingBranch.organizationId}/branches/${branchId}/edit`,
  );
  revalidatePath("/");

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

export async function deleteBranchAction(branchId: string) {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId },
    select: { id: true, organizationId: true, name: true },
  });

  if (!branch) {
    return { data: null, error: "Etablissement introuvable." };
  }

  const guard = await guardOrganizationManager(branch.organizationId);
  if (!guard.ok) {
    return { data: null, error: guard.message };
  }
  if (
    isRestrictedGestionnaire(
      guard.context.appRole,
      guard.context.membership?.role,
    )
  ) {
    return {
      data: null,
      error: "Le gestionnaire ne peut pas supprimer un établissement.",
    };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        await purgeBranchCompletely(tx, branchId);
      },
      { timeout: 120_000, maxWait: 15_000 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2003" || error.code === "P2014")
    ) {
      return {
        data: null,
        error:
          "Impossible de supprimer cet établissement : une donnée liée bloque encore le nettoyage.",
      };
    }

    const message =
      error instanceof Error ? error.message : "Suppression impossible.";
    return { data: null, error: message };
  }

  revalidatePath(`/admin/organizations/${branch.organizationId}/branches`);
  revalidatePath("/");

  return { data: { id: branchId, name: branch.name }, error: null };
}
