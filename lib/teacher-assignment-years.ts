import { prisma } from "@/lib/prisma";

/**
 * Années d'affectation = années scolaires distinctes où l'enseignant
 * a une affectation de classe active.
 */
export async function countTeacherClassAssignmentYears(params: {
  teacherId: string;
  branchId: string;
}): Promise<{ count: number; yearLabels: string[] }> {
  const rows = await prisma.teaching.findMany({
    where: {
      teacherId: params.teacherId,
      AND: [
        {
          OR: [
            { branchId: params.branchId },
            { branchId: null, classe: { branchId: params.branchId } },
          ],
        },
        {
          OR: [{ statusTeaching: true }, { statusTeaching: null }],
        },
      ],
    },
    select: {
      schoolYear: {
        select: { id: true, nameYear: true, startYear: true },
      },
    },
  });

  const unique = new Map<string, { nameYear: string; startYear: Date }>();
  for (const row of rows) {
    const year = row.schoolYear;
    if (!year) continue;
    unique.set(year.id, {
      nameYear: year.nameYear,
      startYear: year.startYear,
    });
  }

  const sorted = [...unique.values()].sort(
    (a, b) => a.startYear.getTime() - b.startYear.getTime(),
  );

  return {
    count: sorted.length,
    yearLabels: sorted.map((item) => item.nameYear),
  };
}

/** Fait progresser `yearsOfExperience` du dossier (jamais à la baisse). */
export async function syncTeacherDossierExperienceYears(params: {
  teacherId: string | null | undefined;
  branchId: string;
}): Promise<number> {
  if (!params.teacherId) return 0;

  const { count } = await countTeacherClassAssignmentYears({
    teacherId: params.teacherId,
    branchId: params.branchId,
  });

  await prisma.jobApplication.updateMany({
    where: {
      teacherId: params.teacherId,
      branchId: params.branchId,
      applicationType: "TEACHER",
      OR: [{ yearsOfExperience: null }, { yearsOfExperience: { lt: count } }],
    },
    data: { yearsOfExperience: count },
  });

  return count;
}
