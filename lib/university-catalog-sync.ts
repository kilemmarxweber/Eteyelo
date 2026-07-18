import { prisma } from "@/lib/prisma";
import { ensureExtendedBranchStructure } from "@/lib/extended-branch-bootstrap";
import { isUniversiteBranch } from "@/lib/branch-capabilities";

export type UniversityFacultySummary = {
  id: string;
  code: string;
  name: string;
  filieres: Array<{
    id: string;
    code: string;
    name: string;
  }>;
};

export async function syncUniversityCatalog(branchId: string) {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { typebranch: true },
  });

  if (!branch || !isUniversiteBranch(branch.typebranch)) {
    throw new Error("Cette branche n'est pas une universite");
  }

  return prisma.$transaction(async (tx) =>
    ensureExtendedBranchStructure(tx, branchId, "UNIVERSITE"),
  );
}

export async function getUniversityCatalogSummary(
  branchId: string,
): Promise<UniversityFacultySummary[]> {
  const sections = await prisma.section.findMany({
    where: { branchId, statusSection: true },
    orderBy: { nameSection: "asc" },
    include: {
      option: {
        where: { statusOption: true },
        orderBy: { nameOption: "asc" },
        select: {
          id: true,
          codeOption: true,
          nameOption: true,
        },
      },
    },
  });

  return sections.map((section) => ({
    id: section.id,
    code: section.codeSection,
    name: section.nameSection,
    filieres: section.option.map((option) => ({
      id: option.id,
      code: option.codeOption,
      name: option.nameOption,
    })),
  }));
}
