import type { Prisma } from "@/prisma/generated/prisma/client";
import {
  ANGOLA_PRIMARY_OPTION_CODE,
  ANGOLA_PRIMARY_OPTION_NAME,
  ANGOLA_PRIMARY_SECTION_CODE,
  ANGOLA_PRIMARY_SECTION_NAME,
} from "@/lib/angola-primary-structure";

type AcademicDb = Pick<Prisma.TransactionClient, "section" | "option">;

export type AngolaPrimaryStructure = {
  section: { id: string; nameSection: string; codeSection: string };
  option: { id: string; nameOption: string; codeOption: string };
};

/**
 * Une seule section + une seule option pour le 1.º ciclo (1ª–4ª).
 * Les pondérations et les classes 1ª–4ª s'y rattachent.
 */
export async function ensureAngolaPrimaryStructure(
  db: AcademicDb,
  branchId: string,
): Promise<AngolaPrimaryStructure> {
  let section = await db.section.findFirst({
    where: {
      branchId,
      OR: [
        { codeSection: ANGOLA_PRIMARY_SECTION_CODE },
        { nameSection: ANGOLA_PRIMARY_SECTION_NAME },
        { nameSection: "Ensino Primário" },
        { nameSection: { equals: "PRIMAIRE", mode: "insensitive" } },
      ],
    },
    select: { id: true, nameSection: true, codeSection: true, cycle: true },
  });

  if (!section) {
    section = await db.section.create({
      data: {
        branchId,
        codeSection: ANGOLA_PRIMARY_SECTION_CODE,
        nameSection: ANGOLA_PRIMARY_SECTION_NAME,
        statusSection: true,
        cycle: "PRIMAIRE",
      },
      select: { id: true, nameSection: true, codeSection: true, cycle: true },
    });
  } else if (
    section.codeSection !== ANGOLA_PRIMARY_SECTION_CODE ||
    section.nameSection !== ANGOLA_PRIMARY_SECTION_NAME ||
    section.cycle !== "PRIMAIRE"
  ) {
    section = await db.section.update({
      where: { id: section.id },
      data: {
        codeSection: ANGOLA_PRIMARY_SECTION_CODE,
        nameSection: ANGOLA_PRIMARY_SECTION_NAME,
        statusSection: true,
        cycle: "PRIMAIRE",
      },
      select: { id: true, nameSection: true, codeSection: true, cycle: true },
    });
  }

  let option = await db.option.findFirst({
    where: {
      branchId,
      OR: [
        { codeOption: ANGOLA_PRIMARY_OPTION_CODE },
        { nameOption: { equals: ANGOLA_PRIMARY_OPTION_NAME, mode: "insensitive" } },
      ],
    },
    select: { id: true, nameOption: true, codeOption: true, statusOption: true },
  });

  if (!option) {
    option = await db.option.create({
      data: {
        branchId,
        sectionId: section.id,
        codeOption: ANGOLA_PRIMARY_OPTION_CODE,
        nameOption: ANGOLA_PRIMARY_OPTION_NAME,
        statusOption: true,
        cycle: "PRIMAIRE",
      },
      select: { id: true, nameOption: true, codeOption: true, statusOption: true },
    });
  } else {
    await db.option.update({
      where: { id: option.id },
      data: {
        sectionId: section.id,
        codeOption: ANGOLA_PRIMARY_OPTION_CODE,
        nameOption: ANGOLA_PRIMARY_OPTION_NAME,
        statusOption: true,
        cycle: "PRIMAIRE",
      },
    });
  }

  return {
    section: {
      id: section.id,
      nameSection: section.nameSection,
      codeSection: section.codeSection,
    },
    option: {
      id: option.id,
      nameOption: option.nameOption,
      codeOption: option.codeOption,
    },
  };
}
