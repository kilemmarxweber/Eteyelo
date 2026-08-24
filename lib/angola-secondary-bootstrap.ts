import type { Prisma } from "@/prisma/generated/prisma/client";
import {
  ANGOLA_CICLO1_SECTION_CODE,
  ANGOLA_CICLO1_SECTION_NAME,
  ANGOLA_CICLO2_SECTION_CODE,
  ANGOLA_CICLO2_SECTION_NAME,
  ANGOLA_CICLO_OPTION_CODE,
  ANGOLA_CICLO_OPTION_CODE_LEGACY,
  ANGOLA_CICLO_OPTION_NAME,
} from "@/lib/angola-secondary-structure";

type AcademicDb = Pick<Prisma.TransactionClient, "section" | "option">;

async function ensureSection(
  db: AcademicDb,
  branchId: string,
  codeSection: string,
  nameSection: string,
) {
  let section = await db.section.findFirst({
    where: {
      branchId,
      OR: [
        { codeSection },
        { nameSection },
        { nameSection: "1.º Ciclo" },
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
      },
      select: { id: true, codeSection: true, nameSection: true },
    });
  } else if (section.nameSection !== nameSection || section.codeSection !== codeSection) {
    section = await db.section.update({
      where: { id: section.id },
      data: { codeSection, nameSection, statusSection: true },
      select: { id: true, codeSection: true, nameSection: true },
    });
  }

  return section;
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
  );
  const ciclo2 = await ensureSection(
    db,
    branchId,
    ANGOLA_CICLO2_SECTION_CODE,
    ANGOLA_CICLO2_SECTION_NAME,
  );

  let option = await db.option.findFirst({
    where: {
      branchId,
      OR: [
        { codeOption: ANGOLA_CICLO_OPTION_CODE },
        { codeOption: ANGOLA_CICLO_OPTION_CODE_LEGACY },
        { nameOption: ANGOLA_CICLO_OPTION_NAME },
        { nameOption: "Ciclo" },
      ],
    },
    select: { id: true, codeOption: true, nameOption: true },
  });

  if (!option) {
    option = await db.option.create({
      data: {
        branchId,
        sectionId: ciclo1.id,
        codeOption: ANGOLA_CICLO_OPTION_CODE,
        nameOption: ANGOLA_CICLO_OPTION_NAME,
        statusOption: true,
      },
      select: { id: true, codeOption: true, nameOption: true },
    });
  } else {
    await db.option.update({
      where: { id: option.id },
      data: {
        sectionId: ciclo1.id,
        codeOption: ANGOLA_CICLO_OPTION_CODE,
        nameOption: ANGOLA_CICLO_OPTION_NAME,
        statusOption: true,
      },
    });
  }

  return { ciclo1, ciclo2, option };
}
