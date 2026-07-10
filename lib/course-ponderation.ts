import { prisma } from "@/lib/prisma";

export async function getCoursePonderation(params: {
  branchId: string;
  coursId?: string | null;
  optionId?: string | null;
}) {
  if (!params.coursId || !params.optionId) return 1;

  const record = await prisma.coursOptionPonderation.findFirst({
    where: {
      branchId: params.branchId,
      coursId: params.coursId,
      optionId: params.optionId,
    },
    select: { ponderation: true },
  });

  return record?.ponderation ?? 1;
}

export async function getCoursePonderationMap(params: {
  branchId: string;
  pairs: Array<{ coursId?: string | null; optionId?: string | null }>;
}) {
  const pairs = params.pairs.filter(
    (pair): pair is { coursId: string; optionId: string } =>
      Boolean(pair.coursId) && Boolean(pair.optionId),
  );

  if (!pairs.length) return new Map<string, number>();

  const records = await prisma.coursOptionPonderation.findMany({
    where: {
      branchId: params.branchId,
      OR: pairs.map((pair) => ({
        coursId: pair.coursId,
        optionId: pair.optionId,
      })),
    },
    select: {
      coursId: true,
      optionId: true,
      ponderation: true,
    },
  });

  return new Map(
    records.map((record) => [
      `${record.coursId}:${record.optionId}`,
      record.ponderation,
    ]),
  );
}

export function resolveCoursePonderation(
  map: Map<string, number>,
  params: { coursId?: string | null; optionId?: string | null },
) {
  if (!params.coursId || !params.optionId) return 1;
  return map.get(`${params.coursId}:${params.optionId}`) ?? 1;
}

