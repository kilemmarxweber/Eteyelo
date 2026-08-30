import type { Prisma } from "@/prisma/generated/prisma/client";
import {
  ANGOLA_CICLO1_SECTION_CODE,
  ANGOLA_CICLO1_SECTION_NAME,
  ANGOLA_CICLO2_SECTION_CODE,
  ANGOLA_CICLO2_SECTION_NAME,
  ANGOLA_CICLO_OPTION_CODE,
  ANGOLA_CICLO_OPTION_CODE_LEGACY,
  ANGOLA_CICLO_OPTION_NAME,
  ANGOLA_ELECT_OPTION_CODE,
  ANGOLA_ELECT_OPTION_NAME,
  ANGOLA_TECNICA_SECTION_CODE,
  ANGOLA_TECNICA_SECTION_NAME,
} from "@/lib/angola-secondary-structure";

type AcademicDb = Pick<Prisma.TransactionClient, "section" | "option">;

async function ensureSection(
  db: AcademicDb,
  branchId: string,
  codeSection: string,
  nameSection: string,
  extraNames: string[] = [],
) {
  let section = await db.section.findFirst({
    where: {
      branchId,
      OR: [
        { codeSection },
        { nameSection },
        ...extraNames.map((name) => ({ nameSection: name })),
      ],
    },
    select: { id: true, codeSection: true, nameSection: true },
  });

  if (!section) {
    section = await db.section.create({
      data: {
        branchId,
        codeSection,
        nameSection,
        statusSection: true,
        cycle: "SECONDAIRE",
      },
      select: { id: true, codeSection: true, nameSection: true },
    });
  } else if (
    section.nameSection !== nameSection ||
    section.codeSection !== codeSection
  ) {
    section = await db.section.update({
      where: { id: section.id },
      data: { codeSection, nameSection, statusSection: true, cycle: "SECONDAIRE" },
      select: { id: true, codeSection: true, nameSection: true },
    });
  }

  return section;
}

async function ensureOption(
  db: AcademicDb,
  branchId: string,
  sectionId: string,
  codeOption: string,
  nameOption: string,
  extraCodes: string[] = [],
  extraNames: string[] = [],
) {
  let option = await db.option.findFirst({
    where: {
      branchId,
      OR: [
        { codeOption },
        { nameOption },
        ...extraCodes.map((code) => ({ codeOption: code })),
        ...extraNames.map((name) => ({ nameOption: name })),
      ],
    },
    select: { id: true, codeOption: true, nameOption: true },
  });

  if (!option) {
    option = await db.option.create({
      data: {
        branchId,
        sectionId,
        codeOption,
        nameOption,
        statusOption: true,
        cycle: "SECONDAIRE",
      },
      select: { id: true, codeOption: true, nameOption: true },
    });
  } else {
    await db.option.update({
      where: { id: option.id },
      data: {
        sectionId,
        codeOption,
        nameOption,
        statusOption: true,
        cycle: "SECONDAIRE",
      },
    });
  }

  return option;
}

export async function ensureAngolaSecondaryStructure(
  db: AcademicDb,
  branchId: string,
) {
  const ciclo1 = await ensureSection(
    db,
    branchId,
    ANGOLA_CICLO1_SECTION_CODE,
    ANGOLA_CICLO1_SECTION_NAME,
    ["1.º Ciclo", "Núcleo comum"],
  );
  const tecnica = await ensureSection(
    db,
    branchId,
    ANGOLA_TECNICA_SECTION_CODE,
    ANGOLA_TECNICA_SECTION_NAME,
  );
  const ciclo2 = await ensureSection(
    db,
    branchId,
    ANGOLA_CICLO2_SECTION_CODE,
    ANGOLA_CICLO2_SECTION_NAME,
  );

  const option = await ensureOption(
    db,
    branchId,
    ciclo1.id,
    ANGOLA_CICLO_OPTION_CODE,
    ANGOLA_CICLO_OPTION_NAME,
    [ANGOLA_CICLO_OPTION_CODE_LEGACY],
    ["Ciclo"],
  );

  const elect = await ensureOption(
    db,
    branchId,
    tecnica.id,
    ANGOLA_ELECT_OPTION_CODE,
    ANGOLA_ELECT_OPTION_NAME,
    [],
    ["Electrotecnia"],
  );

  return { ciclo1, ciclo2, tecnica, option, elect };
}
