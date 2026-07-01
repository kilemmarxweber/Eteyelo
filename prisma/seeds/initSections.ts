import { prisma as Prisma } from "@/lib/prisma";
import { getSeedBranchId } from "./seedContext";

export const sectionsData = [
  {
    codeSection: "HUM-GEN",
    nameSection: "Humanites Generales",
    statusSection: true,
  },
  {
    codeSection: "SCIE",
    nameSection: "SCIENTIFIQUE",
    statusSection: true,
  },
  {
    codeSection: "LITT",
    nameSection: "LITTERAIRE",
    statusSection: true,
  },
  {
    codeSection: "COMM-AD",
    nameSection: "COMMERCIALE ET ADMINISTRATIVE",
    statusSection: true,
  },
  {
    codeSection: "TECH",
    nameSection: "TECHNIQUES",
    statusSection: true,
  },
  {
    codeSection: "PEDA",
    nameSection: "PEDAGOGIQUES",
    statusSection: true,
  },
];

export async function initSections() {
  console.log("Initialisation des sections...");
  const branchId = await getSeedBranchId();

  for (const section of sectionsData) {
    const existing = await Prisma.section.findFirst({
      where: {
        OR: [
          { codeSection: section.codeSection },
          { nameSection: section.nameSection },
        ],
      },
    });

    if (existing) {
      await Prisma.section.update({
        where: { id: existing.id },
        data: {
          ...section,
          branchId,
        },
      });
    } else {
      await Prisma.section.create({
        data: {
          ...section,
          branchId,
        },
      });
    }
  }

  console.log(`OK ${sectionsData.length} sections traitees`);
}

export async function clearSections() {
  console.log("Suppression des sections...");
  await Prisma.section.deleteMany({});
  console.log("OK sections supprimees");
}
