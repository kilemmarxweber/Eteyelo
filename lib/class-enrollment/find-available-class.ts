import type { Prisma } from "@/prisma/generated/prisma/client";
import { matchesClassForLevel } from "@/lib/class-enrollment/match-class-for-level";

type FindAvailableClassInput = {
  branchId: string;
  schoolYearId: string;
  level: string;
  optionId: string | null;
  typebranch: unknown;
  optionName?: string | null;
};

/** Must run in the same transaction as the enrollment insert. */
export async function findAvailableClassForLevel(
  tx: Prisma.TransactionClient,
  {
    branchId,
    schoolYearId,
    level,
    optionId,
    typebranch,
    optionName,
  }: FindAvailableClassInput,
) {
  const classes = await tx.classe.findMany({
    where: {
      branchId,
      OR: [{ statusClasse: true }, { statusClasse: null }],
      capacity: { gt: 0 },
    },
    select: {
      id: true,
      codeClasse: true,
      nameClasse: true,
      level: true,
      parallel: true,
      optionId: true,
      capacity: true,
      option: { select: { id: true, nameOption: true } },
      _count: {
        select: {
          classEnrollment: {
            where: { schoolYearId, statusEnrollment: true, branchId },
          },
        },
      },
    },
  });

  const matchingClasses = classes.filter((classe) =>
    matchesClassForLevel(classe, { typebranch, level, optionId, optionName }),
  );

  matchingClasses.sort((left, right) =>
    (left.parallel ?? "").localeCompare(right.parallel ?? "", "fr", {
      numeric: true,
      sensitivity: "base",
    }),
  );

  return (
    matchingClasses.find(
      (classe) =>
        classe.capacity !== null &&
        classe._count.classEnrollment < classe.capacity,
    ) ?? null
  );
}
