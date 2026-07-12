import type { Prisma } from "@/prisma/generated/prisma/client";

type AcademicDb = Pick<
  Prisma.TransactionClient,
  "section" | "option" | "classe"
>;

export async function ensurePrimaryAcademicStructure(
  db: AcademicDb,
  branchId: string,
) {
  let section = await db.section.findFirst({
    where: { branchId, nameSection: { equals: "PRIMAIRE", mode: "insensitive" } },
    select: { id: true, nameSection: true },
  });
  if (!section) {
    section = await db.section.create({
      data: {
        branchId,
        codeSection: "PRIMAIRE",
        nameSection: "PRIMAIRE",
        statusSection: true,
      },
      select: { id: true, nameSection: true },
    });
  }

  let option = await db.option.findFirst({
    where: { branchId, nameOption: { equals: "PRIMAIRE", mode: "insensitive" } },
    select: { id: true, nameOption: true },
  });
  if (!option) {
    option = await db.option.create({
      data: {
        branchId,
        sectionId: section.id,
        codeOption: "PRIMAIRE",
        nameOption: "PRIMAIRE",
        statusOption: true,
      },
      select: { id: true, nameOption: true },
    });
  }

  await db.classe.updateMany({
    where: { branchId, optionId: null },
    data: { optionId: option.id },
  });

  return { section, option };
}
