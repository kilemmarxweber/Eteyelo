import type { Prisma } from "@/prisma/generated/prisma/client";

import {
  normalizeBranchType,
  type ManagedBranchType,
} from "@/lib/academic-structure";

type AcademicDb = Pick<Prisma.TransactionClient, "section" | "option">;

export type ExtendedBranchBootstrapResult = {
  sectionId?: string;
  optionId?: string;
};

async function ensureSectionAndOption(
  db: AcademicDb,
  branchId: string,
  params: {
    codeSection: string;
    nameSection: string;
    codeOption: string;
    nameOption: string;
  },
): Promise<ExtendedBranchBootstrapResult> {
  let section = await db.section.findFirst({
    where: {
      branchId,
      OR: [
        { codeSection: params.codeSection },
        { nameSection: params.nameSection },
      ],
    },
    select: { id: true },
  });

  if (!section) {
    section = await db.section.create({
      data: {
        branchId,
        codeSection: params.codeSection,
        nameSection: params.nameSection,
        statusSection: true,
      },
      select: { id: true },
    });
  }

  let option = await db.option.findFirst({
    where: {
      branchId,
      OR: [{ codeOption: params.codeOption }, { nameOption: params.nameOption }],
    },
    select: { id: true },
  });

  if (!option) {
    option = await db.option.create({
      data: {
        branchId,
        sectionId: section.id,
        codeOption: params.codeOption,
        nameOption: params.nameOption,
        statusOption: true,
      },
      select: { id: true },
    });
  } else if (option) {
    await db.option.update({
      where: { id: option.id },
      data: { sectionId: section.id, statusOption: true },
    });
  }

  return { sectionId: section.id, optionId: option.id };
}

async function ensureCentreFormationStructure(
  db: AcademicDb,
  branchId: string,
): Promise<ExtendedBranchBootstrapResult> {
  return ensureSectionAndOption(db, branchId, {
    codeSection: "PROGRAMMES",
    nameSection: "Programmes de formation",
    codeOption: "GENERAL",
    nameOption: "Programme general",
  });
}

async function ensureUniversityStructure(
  db: AcademicDb,
  branchId: string,
): Promise<ExtendedBranchBootstrapResult> {
  const faculties = [
    {
      codeSection: "SCIENCES",
      nameSection: "Faculte des Sciences",
      codeOption: "SCI-GEN",
      nameOption: "Sciences generales",
    },
    {
      codeSection: "LETTRES",
      nameSection: "Faculte des Lettres",
      codeOption: "LET-GEN",
      nameOption: "Lettres generales",
    },
  ] as const;

  let lastResult: ExtendedBranchBootstrapResult = {};

  for (const faculty of faculties) {
    lastResult = await ensureSectionAndOption(db, branchId, faculty);
  }

  return lastResult;
}

export async function ensureExtendedBranchStructure(
  db: AcademicDb,
  branchId: string,
  typebranch: unknown,
): Promise<ExtendedBranchBootstrapResult | null> {
  const normalized = normalizeBranchType(typebranch) as ManagedBranchType;

  switch (normalized) {
    case "CENTRE_FORMATION":
      return ensureCentreFormationStructure(db, branchId);
    case "UNIVERSITE":
      return ensureUniversityStructure(db, branchId);
    case "ATELIER":
    case "PRIMAIRE":
    case "SECONDAIRE":
    default:
      return null;
  }
}
