import type { Prisma } from "@/prisma/generated/prisma/client";

type FindAvailableClassInput = {
  branchId: string;
  schoolYearId: string;
  level: string;
  optionId: string | null;
};

/** Must run in the same transaction as the enrollment insert. */
export async function findAvailableClassForLevel(
  tx: Prisma.TransactionClient,
  { branchId, schoolYearId, level, optionId }: FindAvailableClassInput,
) {
  const classes = await tx.classe.findMany({
    where: {
      branchId,
      level,
      optionId,
      statusClasse: true,
      capacity: { gt: 0 },
    },
    select: {
      id: true,
      codeClasse: true,
      nameClasse: true,
      parallel: true,
      capacity: true,
      _count: {
        select: {
          classEnrollment: {
            where: { schoolYearId, statusEnrollment: true, branchId },
          },
        },
      },
    },
  });

  classes.sort((left, right) =>
    (left.parallel ?? "").localeCompare(right.parallel ?? "", "fr", {
      numeric: true,
      sensitivity: "base",
    }),
  );

  return (
    classes.find(
      (classe) =>
        classe.capacity !== null &&
        classe._count.classEnrollment < classe.capacity,
    ) ?? null
  );
}
