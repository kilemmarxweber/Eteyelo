import { prisma as Prisma } from "@/lib/prisma";
import {
  CLASS_CATALOG_OPTIONS,
  CLASS_CATALOG_SECTIONS,
  CTEB_OPTION_CODE,
  CTEB_SECTION_CODE,
  getCatalogAbbrevForOptionName,
  getCatalogOptionByCode,
} from "@/lib/class-catalog";
import {
  MATERNELLE_CLASS_LEVELS,
  PRIMARY_CLASS_LEVELS,
  SECONDARY_CTEB_LEVELS,
  SECONDARY_HUMANITES_LEVELS,
  buildClassCode,
  buildClassName,
} from "@/lib/class-structure";
import { getBranchCycles, isSchoolCycle, normalizeCycle, type Cycle } from "@/lib/cycle";
import { ensurePrimaryAcademicStructure } from "@/lib/primary-academic-structure";
import { ensureMaternelleAcademicStructure } from "@/lib/maternelle-academic-structure";
import { ensureSecondaryCtebStructure } from "@/lib/secondary-cteb-structure";
import { ensureUniqueIdentifier } from "@/lib/generated-identifiers";
import { ensureAngolaPrimaryStructure } from "@/lib/angola-primary-bootstrap";
import { ensureAngolaSecondaryStructure } from "@/lib/angola-secondary-bootstrap";
import { ANGOLA_PRIMARY_FIRST_CYCLE_LEVELS } from "@/lib/angola-primary-structure";
import {
  ANGOLA_ELECT_OPTION_ABBREV,
  ANGOLA_ELECT_OPTION_NAME,
  ANGOLA_FIRST_CYCLE_LEVELS,
  ANGOLA_REDUCED_LEVEL,
  ANGOLA_SECOND_CYCLE_LEVELS,
} from "@/lib/angola-secondary-structure";
import { normalizeEducationSystem } from "@/lib/education-system";

export type UpsertClassCatalogResult = {
  branchId: string;
  created: number;
  skipped: number;
  sectionsCreated: number;
  optionsCreated: number;
};

async function ensureSection(
  branchId: string,
  codeSection: string,
  nameSection: string,
): Promise<{ id: string; created: boolean }> {
  const existing = await Prisma.section.findFirst({
    where: {
      branchId,
      OR: [{ codeSection }, { nameSection }],
    },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  const created = await Prisma.section.create({
    data: {
      branchId,
      codeSection,
      nameSection,
      statusSection: true,
      cycle: "SECONDAIRE",
    },
    select: { id: true },
  });
  return { id: created.id, created: true };
}

async function ensureOption(
  branchId: string,
  sectionId: string,
  codeOption: string,
  nameOption: string,
): Promise<{ id: string; created: boolean }> {
  const existing = await Prisma.option.findFirst({
    where: {
      branchId,
      OR: [{ codeOption }, { nameOption }],
    },
    select: { id: true },
  });
  if (existing) {
    await Prisma.option.update({
      where: { id: existing.id },
      data: { sectionId, statusOption: true, cycle: "SECONDAIRE" },
    });
    return { id: existing.id, created: false };
  }

  const created = await Prisma.option.create({
    data: {
      branchId,
      sectionId,
      codeOption,
      nameOption,
      statusOption: true,
      cycle: "SECONDAIRE",
    },
    select: { id: true },
  });
  return { id: created.id, created: true };
}

async function upsertClasseRow(params: {
  branchId: string;
  typebranch: unknown;
  level: string;
  optionId: string | null;
  optionName: string | null;
  optionAbbrev?: string | null;
  cycle: Cycle;
  educationSystem?: unknown;
}): Promise<"created" | "skipped"> {
  const nameClasse = buildClassName({
    typebranch: params.typebranch,
    educationSystem: params.educationSystem,
    level: params.level,
    optionName: params.optionName,
  });
  const codeBase = buildClassCode({
    typebranch: params.typebranch,
    educationSystem: params.educationSystem,
    level: params.level,
    optionName: params.optionName,
    optionAbbrev: params.optionAbbrev,
  });

  const byName = await Prisma.classe.findFirst({
    where: { branchId: params.branchId, nameClasse },
    select: { id: true, cycle: true },
  });
  if (byName) {
    const sameCycle =
      !byName.cycle || normalizeCycle(byName.cycle) === params.cycle;
    if (sameCycle) {
      await Prisma.classe.update({
        where: { id: byName.id },
        data: {
          cycle: params.cycle,
          ...(params.optionId ? { optionId: params.optionId } : {}),
        },
      });
      return "skipped";
    }
  }

  const byCode = await Prisma.classe.findFirst({
    where: { branchId: params.branchId, codeClasse: codeBase },
    select: { id: true, cycle: true },
  });
  if (byCode) {
    const sameCycle =
      !byCode.cycle || normalizeCycle(byCode.cycle) === params.cycle;
    if (sameCycle) {
      await Prisma.classe.update({
        where: { id: byCode.id },
        data: {
          cycle: params.cycle,
          ...(params.optionId ? { optionId: params.optionId } : {}),
        },
      });
      return "skipped";
    }
  }

  const uniqueName = byName
    ? await ensureUniqueIdentifier({
        base: nameClasse,
        separator: " ",
        exists: async (value) =>
          Boolean(
            await Prisma.classe.findFirst({
              where: { branchId: params.branchId, nameClasse: value },
              select: { id: true },
            }),
          ),
      })
    : nameClasse;

  const codeClasse = await ensureUniqueIdentifier({
    base: codeBase,
    separator: "",
    exists: async (value) =>
      Boolean(
        await Prisma.classe.findFirst({
          where: { branchId: params.branchId, codeClasse: value },
          select: { id: true },
        }),
      ),
  });

  await Prisma.classe.create({
    data: {
      branchId: params.branchId,
      nameClasse: uniqueName,
      codeClasse,
      level: params.level,
      parallel: null,
      optionId: params.optionId,
      capacity: 30,
      statusClasse: true,
      cycle: params.cycle,
    },
  });
  return "created";
}

export type UpsertClassCatalogOptions = {
  /** D3=A/C : upsert toutes les sections/options du catalogue. D3=B : false. */
  importSectionsAndOptions?: boolean;
  cycles?: Cycle[];
};

/**
 * Importe le catalogue de classes pour les cycles activés (maternelle, primaire, secondaire).
 */
async function upsertAngolaClassCatalog(
  branchId: string,
  cycles: Cycle[],
): Promise<UpsertClassCatalogResult> {
  let created = 0;
  let skipped = 0;
  let sectionsCreated = 0;
  let optionsCreated = 0;
  const educationSystem = "ANGOLAIS";

  if (cycles.includes("MATERNELLE")) {
    const { optionsByLevel } = await ensureMaternelleAcademicStructure(
      Prisma,
      branchId,
    );
    for (const level of MATERNELLE_CLASS_LEVELS) {
      const option = optionsByLevel[level];
      const result = await upsertClasseRow({
        branchId,
        typebranch: "MATERNELLE",
        educationSystem,
        level,
        optionId: option.id,
        optionName: null,
        cycle: "MATERNELLE",
      });
      if (result === "created") created += 1;
      else skipped += 1;
    }
  }

  if (cycles.includes("PRIMAIRE")) {
    const beforeSections = await Prisma.section.count({ where: { branchId } });
    const beforeOptions = await Prisma.option.count({ where: { branchId } });
    const { option } = await ensureAngolaPrimaryStructure(Prisma, branchId);
    const afterSections = await Prisma.section.count({ where: { branchId } });
    const afterOptions = await Prisma.option.count({ where: { branchId } });
    sectionsCreated += Math.max(0, afterSections - beforeSections);
    optionsCreated += Math.max(0, afterOptions - beforeOptions);

    for (const level of ANGOLA_PRIMARY_FIRST_CYCLE_LEVELS) {
      const result = await upsertClasseRow({
        branchId,
        typebranch: "PRIMAIRE",
        educationSystem,
        level,
        optionId: option.id,
        optionName: null,
        cycle: "PRIMAIRE",
      });
      if (result === "created") created += 1;
      else skipped += 1;
    }
  }

  if (!cycles.includes("SECONDAIRE")) {
    return { branchId, created, skipped, sectionsCreated, optionsCreated };
  }

  const beforeSections = await Prisma.section.count({ where: { branchId } });
  const beforeOptions = await Prisma.option.count({ where: { branchId } });
  const angola = await ensureAngolaSecondaryStructure(Prisma, branchId);
  const afterSections = await Prisma.section.count({ where: { branchId } });
  const afterOptions = await Prisma.option.count({ where: { branchId } });
  sectionsCreated += Math.max(0, afterSections - beforeSections);
  optionsCreated += Math.max(0, afterOptions - beforeOptions);

  for (const level of ANGOLA_FIRST_CYCLE_LEVELS) {
    const result = await upsertClasseRow({
      branchId,
      typebranch: "SECONDAIRE",
      educationSystem,
      level,
      optionId: angola.option.id,
      optionName: null,
      cycle: "SECONDAIRE",
    });
    if (result === "created") created += 1;
    else skipped += 1;
  }

  const secondCycleLevels = [
    ...ANGOLA_SECOND_CYCLE_LEVELS,
    ANGOLA_REDUCED_LEVEL,
  ];
  for (const level of secondCycleLevels) {
    const result = await upsertClasseRow({
      branchId,
      typebranch: "SECONDAIRE",
      educationSystem,
      level,
      optionId: angola.elect.id,
      optionName: ANGOLA_ELECT_OPTION_NAME,
      optionAbbrev: ANGOLA_ELECT_OPTION_ABBREV,
      cycle: "SECONDAIRE",
    });
    if (result === "created") created += 1;
    else skipped += 1;
  }

  return { branchId, created, skipped, sectionsCreated, optionsCreated };
}

export async function upsertClassCatalogForBranch(
  branchId: string,
  options: UpsertClassCatalogOptions = {},
): Promise<UpsertClassCatalogResult> {
  const branch = await Prisma.branch.findUnique({
    where: { id: branchId },
    select: {
      id: true,
      typebranch: true,
      educationSystem: true,
      cycles: { where: { isActive: true }, select: { cycle: true, isActive: true, sortOrder: true } },
    },
  });
  if (!branch) {
    throw new Error("Branche introuvable");
  }

  const cycles = (options.cycles?.length
    ? options.cycles
    : getBranchCycles(branch)
  ).filter((cycle) => isSchoolCycle(cycle) || cycle === branch.typebranch);

  if (normalizeEducationSystem(branch.educationSystem) === "ANGOLAIS") {
    return upsertAngolaClassCatalog(branchId, cycles);
  }

  const importAll = options.importSectionsAndOptions ?? cycles.includes("SECONDAIRE");
  let created = 0;
  let skipped = 0;
  let sectionsCreated = 0;
  let optionsCreated = 0;

  if (cycles.includes("MATERNELLE")) {
    const { optionsByLevel } = await ensureMaternelleAcademicStructure(
      Prisma,
      branchId,
    );
    for (const level of MATERNELLE_CLASS_LEVELS) {
      const option = optionsByLevel[level];
      const result = await upsertClasseRow({
        branchId,
        typebranch: "MATERNELLE",
        level,
        optionId: option.id,
        optionName: null,
        cycle: "MATERNELLE",
      });
      if (result === "created") created += 1;
      else skipped += 1;
    }
  }

  if (cycles.includes("PRIMAIRE")) {
    const { optionsByLevel } = await ensurePrimaryAcademicStructure(
      Prisma,
      branchId,
    );
    for (const level of PRIMARY_CLASS_LEVELS) {
      const option = optionsByLevel[level];
      const result = await upsertClasseRow({
        branchId,
        typebranch: "PRIMAIRE",
        level,
        optionId: option.id,
        optionName: null,
        cycle: "PRIMAIRE",
      });
      if (result === "created") created += 1;
      else skipped += 1;
    }
  }

  if (!cycles.includes("SECONDAIRE")) {
    return { branchId, created, skipped, sectionsCreated, optionsCreated };
  }

  if (importAll) {
    for (const section of CLASS_CATALOG_SECTIONS) {
      const s = await ensureSection(
        branchId,
        section.codeSection,
        section.nameSection,
      );
      if (s.created) sectionsCreated += 1;
      for (const opt of CLASS_CATALOG_OPTIONS.filter(
        (o) => o.sectionCode === section.codeSection,
      )) {
        const o = await ensureOption(
          branchId,
          s.id,
          opt.codeOption,
          opt.nameOption,
        );
        if (o.created) optionsCreated += 1;
      }
    }
  }

  const cteb = await ensureSecondaryCtebStructure(Prisma, branchId);
  if (cteb.sectionCreated) sectionsCreated += 1;
  if (cteb.optionCreated) optionsCreated += 1;

  const ctebOptMeta = getCatalogOptionByCode(CTEB_OPTION_CODE)!;

  for (const level of SECONDARY_CTEB_LEVELS) {
    const result = await upsertClasseRow({
      branchId,
      typebranch: "SECONDAIRE",
      level,
      optionId: cteb.option.id,
      optionName: ctebOptMeta.nameOption,
      optionAbbrev: ctebOptMeta.abbrev,
      cycle: "SECONDAIRE",
    });
    if (result === "created") created += 1;
    else skipped += 1;
  }

  const activeOptions = await Prisma.option.findMany({
    where: {
      branchId,
      statusOption: { not: false },
      cycle: "SECONDAIRE",
      codeOption: { not: CTEB_OPTION_CODE },
      NOT: { nameOption: ctebOptMeta.nameOption },
    },
    select: {
      id: true,
      nameOption: true,
      codeOption: true,
      section: { select: { codeSection: true } },
    },
  });

  for (const opt of activeOptions) {
    if (opt.section?.codeSection === CTEB_SECTION_CODE) continue;

    const abbrev =
      getCatalogOptionByCode(opt.codeOption)?.abbrev ||
      getCatalogAbbrevForOptionName(opt.nameOption) ||
      undefined;

    for (const level of SECONDARY_HUMANITES_LEVELS) {
      const result = await upsertClasseRow({
        branchId,
        typebranch: "SECONDAIRE",
        level,
        optionId: opt.id,
        optionName: opt.nameOption,
        optionAbbrev: abbrev,
        cycle: "SECONDAIRE",
      });
      if (result === "created") created += 1;
      else skipped += 1;
    }
  }

  return { branchId, created, skipped, sectionsCreated, optionsCreated };
}

