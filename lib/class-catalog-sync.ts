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
  PRIMARY_CLASS_LEVELS,
  SECONDARY_CTEB_LEVELS,
  SECONDARY_HUMANITES_LEVELS,
  buildClassCode,
  buildClassName,
} from "@/lib/class-structure";
import { ensurePrimaryAcademicStructure } from "@/lib/primary-academic-structure";
import { ensureUniqueIdentifier } from "@/lib/generated-identifiers";
import { normalizeBranchType } from "@/lib/academic-structure";

export type UpsertClassCatalogResult = {
  branchId: string;
  created: number;
  skipped: number;
  sectionsCreated: number;
  optionsCreated: number;
};

export type UpsertClassCatalogOptions = {
  /** D3=A/C : upsert toutes les sections/options du catalogue. D3=B : false. */
  importSectionsAndOptions?: boolean;
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
      data: { sectionId, statusOption: true },
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
    },
    select: { id: true },
  });
  return { id: created.id, created: true };
}

async function upsertClasseRow(params: {
  branchId: string;
  typebranch: "PRIMAIRE" | "SECONDAIRE";
  level: string;
  optionId: string | null;
  optionName: string | null;
  optionAbbrev?: string | null;
}): Promise<"created" | "skipped"> {
  const nameClasse = buildClassName({
    typebranch: params.typebranch,
    level: params.level,
    optionName: params.optionName,
  });
  const codeBase = buildClassCode({
    typebranch: params.typebranch,
    level: params.level,
    optionName: params.optionName,
    optionAbbrev: params.optionAbbrev,
  });

  const byName = await Prisma.classe.findFirst({
    where: { branchId: params.branchId, nameClasse },
    select: { id: true },
  });
  if (byName) return "skipped";

  const byCode = await Prisma.classe.findFirst({
    where: { branchId: params.branchId, codeClasse: codeBase },
    select: { id: true },
  });
  if (byCode) return "skipped";

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
      nameClasse,
      codeClasse,
      level: params.level,
      parallel: null,
      optionId: params.optionId,
      capacity: 30,
      statusClasse: true,
    },
  });
  return "created";
}

/**
 * Import catalogue classes pour une branche (D3=B par défaut + CTEB forcé).
 */
export async function upsertClassCatalogForBranch(
  branchId: string,
  options: UpsertClassCatalogOptions = {},
): Promise<UpsertClassCatalogResult> {
  const importAll = options.importSectionsAndOptions ?? false;

  const branch = await Prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, typebranch: true },
  });
  if (!branch) {
    throw new Error("Branche introuvable");
  }

  const typebranch = normalizeBranchType(branch.typebranch);
  let created = 0;
  let skipped = 0;
  let sectionsCreated = 0;
  let optionsCreated = 0;

  if (typebranch === "PRIMAIRE") {
    const { option } = await ensurePrimaryAcademicStructure(Prisma, branchId);
    for (const level of PRIMARY_CLASS_LEVELS) {
      const result = await upsertClasseRow({
        branchId,
        typebranch: "PRIMAIRE",
        level,
        optionId: option.id,
        optionName: null,
      });
      if (result === "created") created += 1;
      else skipped += 1;
    }
    return { branchId, created, skipped, sectionsCreated, optionsCreated };
  }

  // —— SECONDAIRE ——
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

  // Toujours garantir CTEB + Tronc commun
  const ctebSectionMeta = CLASS_CATALOG_SECTIONS.find(
    (s) => s.codeSection === CTEB_SECTION_CODE,
  )!;
  const ctebOptMeta = getCatalogOptionByCode(CTEB_OPTION_CODE)!;
  const ctebSection = await ensureSection(
    branchId,
    ctebSectionMeta.codeSection,
    ctebSectionMeta.nameSection,
  );
  if (ctebSection.created) sectionsCreated += 1;
  const troncCommun = await ensureOption(
    branchId,
    ctebSection.id,
    ctebOptMeta.codeOption,
    ctebOptMeta.nameOption,
  );
  if (troncCommun.created) optionsCreated += 1;

  for (const level of SECONDARY_CTEB_LEVELS) {
    const result = await upsertClasseRow({
      branchId,
      typebranch: "SECONDAIRE",
      level,
      optionId: troncCommun.id,
      optionName: ctebOptMeta.nameOption,
      optionAbbrev: ctebOptMeta.abbrev,
    });
    if (result === "created") created += 1;
    else skipped += 1;
  }

  // Humanités : options actives hors Tronc commun
  const activeOptions = await Prisma.option.findMany({
    where: {
      branchId,
      statusOption: { not: false },
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
    // Ignorer options rattachées à CTEB
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
      });
      if (result === "created") created += 1;
      else skipped += 1;
    }
  }

  return { branchId, created, skipped, sectionsCreated, optionsCreated };
}
