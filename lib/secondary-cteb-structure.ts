import type { Prisma } from "@/prisma/generated/prisma/client";
import {
  CLASS_CATALOG_SECTIONS,
  CTEB_OPTION_CODE,
  CTEB_SECTION_CODE,
  getCatalogOptionByCode,
} from "@/lib/class-catalog";

type AcademicDb = Pick<Prisma.TransactionClient, "section" | "option">;

/**
 * Garantit la section Éducation de Base (CTEB) + option Tronc commun
 * pour les niveaux 7è / 8è d'une branche secondaire.
 */
export async function ensureSecondaryCtebStructure(
  db: AcademicDb,
  branchId: string,
) {
  const sectionMeta = CLASS_CATALOG_SECTIONS.find(
    (s) => s.codeSection === CTEB_SECTION_CODE,
  )!;
  const optionMeta = getCatalogOptionByCode(CTEB_OPTION_CODE)!;

  let section = await db.section.findFirst({
    where: {
      branchId,
      OR: [
        { codeSection: sectionMeta.codeSection },
        { nameSection: sectionMeta.nameSection },
      ],
    },
    select: { id: true, codeSection: true, nameSection: true },
  });

  let sectionCreated = false;
  if (!section) {
    section = await db.section.create({
      data: {
        branchId,
        codeSection: sectionMeta.codeSection,
        nameSection: sectionMeta.nameSection,
        statusSection: true,
      },
      select: { id: true, codeSection: true, nameSection: true },
    });
    sectionCreated = true;
  }

  let option = await db.option.findFirst({
    where: {
      branchId,
      OR: [
        { codeOption: optionMeta.codeOption },
        { nameOption: optionMeta.nameOption },
      ],
    },
    select: { id: true, codeOption: true, nameOption: true },
  });

  let optionCreated = false;
  if (!option) {
    option = await db.option.create({
      data: {
        branchId,
        sectionId: section.id,
        codeOption: optionMeta.codeOption,
        nameOption: optionMeta.nameOption,
        statusOption: true,
      },
      select: { id: true, codeOption: true, nameOption: true },
    });
    optionCreated = true;
  } else {
    await db.option.update({
      where: { id: option.id },
      data: { sectionId: section.id, statusOption: true },
    });
  }

  return { section, option, sectionCreated, optionCreated };
}
