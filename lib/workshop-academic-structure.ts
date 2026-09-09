import type { Prisma } from "@/prisma/generated/prisma/client";
import { generateCode, ensureUniqueIdentifier } from "@/lib/generated-identifiers";

type AcademicDb = Pick<
  Prisma.TransactionClient,
  "section" | "option" | "classe" | "typeFrais"
>;

export const WORKSHOP_SECTION_CODE = "ATELIER";
export const WORKSHOP_OPTION_CODE = "ATL-GROUPE";
export const WORKSHOP_OPTION_NAME = "Groupe";
export const WORKSHOP_FEE_TYPE_NAME = "Frais atelier";

export type WorkshopAcademicStructure = {
  section: { id: string; nameSection: string };
  option: { id: string; nameOption: string; codeOption: string };
};

/**
 * Garantit section + option de pondération internes (non exposées dans le menu).
 * Réassigne les groupes atelier sur cette option pour permettre les affectations.
 */
export async function ensureWorkshopAcademicStructure(
  db: AcademicDb,
  branchId: string,
): Promise<WorkshopAcademicStructure> {
  let section = await db.section.findFirst({
    where: {
      branchId,
      OR: [
        { codeSection: WORKSHOP_SECTION_CODE },
        { nameSection: { equals: "ATELIER", mode: "insensitive" } },
      ],
    },
    select: { id: true, nameSection: true, cycle: true },
  });

  if (!section) {
    section = await db.section.create({
      data: {
        branchId,
        codeSection: WORKSHOP_SECTION_CODE,
        nameSection: "ATELIER",
        statusSection: true,
        cycle: "ATELIER",
      },
      select: { id: true, nameSection: true, cycle: true },
    });
  } else if (section.cycle !== "ATELIER") {
    section = await db.section.update({
      where: { id: section.id },
      data: { cycle: "ATELIER" },
      select: { id: true, nameSection: true, cycle: true },
    });
  }

  let option = await db.option.findFirst({
    where: {
      branchId,
      OR: [
        { codeOption: WORKSHOP_OPTION_CODE },
        {
          nameOption: { equals: WORKSHOP_OPTION_NAME, mode: "insensitive" },
          cycle: "ATELIER",
        },
      ],
    },
    select: {
      id: true,
      nameOption: true,
      codeOption: true,
      statusOption: true,
    },
  });

  if (!option) {
    option = await db.option.create({
      data: {
        branchId,
        sectionId: section.id,
        codeOption: WORKSHOP_OPTION_CODE,
        nameOption: WORKSHOP_OPTION_NAME,
        statusOption: true,
        cycle: "ATELIER",
      },
      select: { id: true, nameOption: true, codeOption: true, statusOption: true },
    });
  } else if (
    option.codeOption !== WORKSHOP_OPTION_CODE ||
    option.nameOption !== WORKSHOP_OPTION_NAME ||
    option.statusOption === false
  ) {
    option = await db.option.update({
      where: { id: option.id },
      data: {
        sectionId: section.id,
        codeOption: WORKSHOP_OPTION_CODE,
        nameOption: WORKSHOP_OPTION_NAME,
        statusOption: true,
        cycle: "ATELIER",
      },
      select: { id: true, nameOption: true, codeOption: true, statusOption: true },
    });
  }

  const classes = await db.classe.findMany({
    where: {
      branchId,
      OR: [{ cycle: "ATELIER" }, { cycle: null, level: "Groupe" }],
    },
    select: { id: true, optionId: true, cycle: true, level: true },
  });

  for (const classe of classes) {
    if (classe.optionId === option.id && classe.cycle === "ATELIER") continue;
    await db.classe.update({
      where: { id: classe.id },
      data: {
        optionId: option.id,
        cycle: "ATELIER",
        ...(classe.level !== "Groupe" ? { level: "Groupe" } : {}),
      },
    });
  }

  await ensureWorkshopFeeType(db, branchId);

  return {
    section: { id: section.id, nameSection: section.nameSection },
    option: {
      id: option.id,
      nameOption: option.nameOption,
      codeOption: option.codeOption,
    },
  };
}

export async function ensureWorkshopFeeType(db: AcademicDb, branchId: string) {
  const existing = await db.typeFrais.findFirst({
    where: {
      branchId,
      nameType: { equals: WORKSHOP_FEE_TYPE_NAME, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (existing) return existing;

  const codeType = await ensureUniqueIdentifier({
    base: generateCode(WORKSHOP_FEE_TYPE_NAME, "FA", 16),
    separator: "",
    exists: async (value) =>
      Boolean(
        await db.typeFrais.findUnique({
          where: { codeType: value },
          select: { id: true },
        }),
      ),
  });

  return db.typeFrais.create({
    data: {
      branchId,
      codeType,
      nameType: WORKSHOP_FEE_TYPE_NAME,
      description: "Frais de participation à l'atelier pratique",
      statusType: true,
      cycle: "ATELIER",
    },
    select: { id: true },
  });
}
