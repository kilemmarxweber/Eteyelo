import { prisma as Prisma } from "@/lib/prisma";
import { getSeedBranchId } from "./seedContext";

export const schoolYearsData = [
  {
    nameYear: "2023-2024",
    startYear: new Date("2023-09-04"),
    endYear: new Date("2024-06-28"),
    isCurrentYear: false,
  },
  {
    nameYear: "2024-2025",
    startYear: new Date("2024-09-02"),
    endYear: new Date("2025-06-27"),
    isCurrentYear: false,
  },
  {
    nameYear: "2025-2026",
    startYear: new Date("2025-09-01"),
    endYear: new Date("2026-06-26"),
    isCurrentYear: true,
  },
];

export async function initSchoolYears() {
  console.log("Initialisation des annees scolaires...");
  const branchId = await getSeedBranchId();

  for (const schoolYear of schoolYearsData) {
    await Prisma.schoolYear.upsert({
      where: {
        branchId_nameYear: {
          branchId,
          nameYear: schoolYear.nameYear,
        },
      },
      update: {
        ...schoolYear,
        branchId,
      },
      create: {
        ...schoolYear,
        branchId,
      },
    });
  }

  console.log(`OK ${schoolYearsData.length} annees scolaires traitees`);
}

export async function clearSchoolYears() {
  console.log("Suppression des annees scolaires...");
  await Prisma.schoolYear.deleteMany({});
  console.log("OK annees scolaires supprimees");
}
