import { ensureAcademicPeriodsForBranch } from "@/lib/academic-periods";
import { prisma as Prisma } from "@/lib/prisma";
import { getSeedBranchId } from "./seedContext";

export async function initPeriods() {
  console.log("Initialisation des periodes...");
  const branchId = await getSeedBranchId();
  const branch = await Prisma.branch.findUnique({
    where: { id: branchId },
    select: { typebranch: true },
  });

  await ensureAcademicPeriodsForBranch({
    branchId,
    typebranch: branch?.typebranch ?? "SECONDAIRE",
    startDate: new Date("2025-09-01"),
    endDate: new Date("2026-06-26"),
  });

  console.log("OK periodes traitees");
}

export async function clearPeriods() {
  console.log("Suppression des periodes et semesters...");
  await Prisma.period.deleteMany({});
  await Prisma.semester.deleteMany({});
  console.log("OK periodes et semesters supprimes");
}
